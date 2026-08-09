/**
 * Import real listings from a JSON file.
 *
 *   npm run import -- data/my-listings.json
 *   npm run import -- data/my-listings.json --dry-run
 *
 * Unlike `npm run seed`, this NEVER deletes anything. It adds listings and
 * updates ones it has seen before, so you can run it repeatedly as you gather
 * more places.
 *
 * Matching is on (school + address), which is what actually identifies a
 * property — titles get reworded, addresses do not. Re-running with a changed
 * rent or description updates the existing listing instead of creating a
 * duplicate.
 *
 * ---------------------------------------------------------------------------
 * A NOTE ON WHAT YOU PUT IN HERE
 *
 * Listing a real property's name, address and rent is factual directory
 * information — the same thing JustDial, NoBroker and Google Maps publish.
 * That is fine.
 *
 * Writing REVIEWS for a real property yourself is not. An invented complaint
 * about a real, findable landlord, published on a site you own, is defamation
 * exposure with no upside. This importer deliberately has no way to create
 * reviews: those come from real tenants or not at all.
 * ------------------------------------------------------------------------- */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/db');
const User = require('./models/User');
const Listing = require('./models/Listing');

const DEFAULT_CURATOR = {
  name: 'CampusNest',
  email: 'listings@campusnest.dev',
  school: 'CampusNest',
};

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').trim()));

/** Validate one row. Returns an array of human-readable problems. */
function validate(row, index) {
  const problems = [];
  const label = `#${index + 1}${row.title ? ` "${String(row.title).slice(0, 40)}"` : ''}`;

  const text = (key, min, max) => {
    const value = typeof row[key] === 'string' ? row[key].trim() : '';
    if (!value) problems.push(`${label}: ${key} is required`);
    else if (value.length < min) problems.push(`${label}: ${key} must be at least ${min} characters`);
    else if (value.length > max) problems.push(`${label}: ${key} must be ${max} characters or fewer`);
  };

  text('title', 3, 120);
  text('address', 5, 200);
  text('school', 2, 120);
  text('description', 20, 4000);

  const rent = num(row.rentPerMonth);
  if (!Number.isFinite(rent) || rent <= 0) problems.push(`${label}: rentPerMonth must be a number above 0`);

  const beds = num(row.bedrooms);
  if (!Number.isInteger(beds) || beds < 0) problems.push(`${label}: bedrooms must be a whole number (0 for a studio)`);

  const hasLat = row.lat !== undefined && row.lat !== null && row.lat !== '';
  const hasLng = row.lng !== undefined && row.lng !== null && row.lng !== '';
  if (hasLat !== hasLng) {
    problems.push(`${label}: lat and lng must both be present, or both omitted`);
  } else if (hasLat) {
    const lat = num(row.lat);
    const lng = num(row.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) problems.push(`${label}: lat must be between -90 and 90`);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) problems.push(`${label}: lng must be between -180 and 180`);
  }

  if (row.images !== undefined) {
    if (!Array.isArray(row.images)) {
      problems.push(`${label}: images must be an array of absolute https URLs`);
    } else {
      if (row.images.length > 5) problems.push(`${label}: at most 5 images`);
      row.images.forEach((url) => {
        if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
          problems.push(`${label}: image "${String(url).slice(0, 40)}" must be an absolute http(s) URL`);
        }
      });
    }
  }

  return problems;
}

function toDoc(row, ownerId) {
  const hasCoords = row.lat !== undefined && row.lat !== null && row.lat !== '';
  return {
    title: row.title.trim(),
    address: row.address.trim(),
    school: row.school.trim(),
    description: row.description.trim(),
    rentPerMonth: num(row.rentPerMonth),
    bedrooms: num(row.bedrooms),
    lat: hasCoords ? num(row.lat) : null,
    lng: hasCoords ? num(row.lng) : null,
    images: Array.isArray(row.images) ? row.images.slice(0, 5) : [],
    createdBy: ownerId,
  };
}

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((a) => !a.startsWith('--'));

  if (!file) {
    console.error(
      '\nUsage: npm run import -- <file.json> [--dry-run]\n\n' +
        'See data/listings.example.json for the expected shape.\n'
    );
    process.exit(1);
  }

  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.error(`\n[import] File not found: ${abs}\n`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    console.error(`\n[import] ${path.basename(abs)} is not valid JSON: ${err.message}\n`);
    process.exit(1);
  }

  const rows = Array.isArray(parsed) ? parsed : parsed.listings;
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error('\n[import] Expected an array of listings, or { "listings": [...] }.\n');
    process.exit(1);
  }

  // Validate everything before touching the database, so a bad row 30 does not
  // leave you with 29 imported and no idea where it stopped.
  const problems = rows.flatMap((row, i) => validate(row, i));
  if (problems.length) {
    console.error(`\n[import] ${problems.length} problem(s) found — nothing was imported:\n`);
    problems.forEach((p) => console.error('  - ' + p));
    console.error('');
    process.exit(1);
  }

  console.log(`[import] ${rows.length} listing(s) validated OK`);
  if (dryRun) {
    console.log('[import] --dry-run: stopping before any database writes.\n');
    rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.title}  (${r.school})`));
    console.log('');
    return;
  }

  await connectDB();
  console.log(`[import] target database: ${mongoose.connection.name}`);

  // Everything imported is attributed to one curator account, so it is obvious
  // which listings came from a bulk import and which a real user posted.
  const ownerSpec = { ...DEFAULT_CURATOR, ...(parsed.owner || {}) };
  let owner = await User.findOne({ email: ownerSpec.email.toLowerCase() });
  if (!owner) {
    owner = await User.create({
      name: ownerSpec.name,
      email: ownerSpec.email.toLowerCase(),
      school: ownerSpec.school,
      passwordHash: await User.hashPassword(require('crypto').randomBytes(24).toString('hex')),
      emailVerified: true,
    });
    console.log(`[import] created curator account ${owner.email}`);
  } else {
    console.log(`[import] using existing curator account ${owner.email}`);
  }

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const doc = toDoc(row, owner._id);
    // Address identifies a property; titles get reworded.
    const existing = await Listing.findOne({
      school: doc.school,
      address: doc.address,
    });

    if (existing) {
      // Never clobber images a real user uploaded with an empty array.
      const { images, createdBy, ...rest } = doc; // eslint-disable-line no-unused-vars
      Object.assign(existing, rest);
      if (images.length) existing.images = images;
      await existing.save();
      updated += 1;
    } else {
      await Listing.create(doc);
      created += 1;
    }
  }

  console.log(`\n[import] created ${created}, updated ${updated}`);
  console.log(`[import] total listings now: ${await Listing.countDocuments()}\n`);

  await disconnectDB();
}

run().catch(async (err) => {
  console.error('\n[import] Failed:', err.message);
  if (err.errors) console.error(err.errors);
  await disconnectDB().catch(() => {});
  process.exit(1);
});

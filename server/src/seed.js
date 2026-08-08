/**
 * Seeds CampusNest with demo users, listings and reviews.
 *
 *   npm run seed
 *
 * WARNING: this wipes the User, Listing and Review collections in the database
 * that MONGODB_URI points at. It refuses to run when NODE_ENV=production unless
 * you pass --force.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/db');
const User = require('./models/User');
const Listing = require('./models/Listing');
const Review = require('./models/Review');

const DEMO_PASSWORD = 'password123';

/* ------------------------------- users ---------------------------------- */
// The first three are the "demo accounts" advertised in the README; the rest
// exist so every listing has a few different voices reviewing it.
const users = [
  { key: 'maya',   name: 'Maya Alvarez',    email: 'maya@campusnest.dev',   school: 'Kingsley State University' },
  { key: 'devin',  name: 'Devin Okafor',    email: 'devin@campusnest.dev',  school: 'Marlowe College' },
  { key: 'priya',  name: 'Priya Raghavan',  email: 'priya@campusnest.dev',  school: 'Fairhaven Institute of Technology' },
  { key: 'sam',    name: 'Sam Whitaker',    email: 'sam@campusnest.dev',    school: 'Lakeview University' },
  { key: 'noor',   name: 'Noor Haddad',     email: 'noor@campusnest.dev',   school: 'Kingsley State University' },
  { key: 'tobias', name: 'Tobias Lindqvist', email: 'tobias@campusnest.dev', school: 'Marlowe College' },
];

/* ------------------------------ listings -------------------------------- */
const listings = [
  {
    key: 'oakline',
    owner: 'maya',
    title: 'Oakline Flats — 2BR with in-unit laundry',
    address: '412 Oakline Ave, Kingsley, OH',
    school: 'Kingsley State University',
    description:
      'Two-bedroom on the second floor of a small walk-up, eight minutes from the engineering quad. In-unit washer/dryer, dishwasher, and a radiator that actually keeps up in February. Street parking is free after 6pm. Landlord lives two blocks away and handles most things same-week.',
    rentPerMonth: 1250,
    bedrooms: 2,
    lat: 40.0012,
    lng: -83.0141,
  },
  {
    key: 'brickyard',
    owner: 'noor',
    title: 'Brickyard Sublet — private room, May–Aug',
    address: '77 Brickyard Ln, Kingsley, OH',
    school: 'Kingsley State University',
    description:
      'Summer sublet in a four-person house. Your room is the big one at the back with two windows and a desk that stays. Shared kitchen is huge, backyard has a grill. Housemates are two grad students and a nurse, all quiet on weeknights. Utilities split four ways, usually about $45/month each.',
    rentPerMonth: 620,
    bedrooms: 1,
    lat: 39.9948,
    lng: -83.0203,
  },
  {
    key: 'pemberton',
    owner: 'devin',
    title: 'Pemberton Court Studio — steps from the library',
    address: '1900 Pemberton Ct #3C, Kingsley, OH',
    school: 'Kingsley State University',
    description:
      'Compact studio in a managed building right across from the main library. Card-access front door, laundry in the basement, heat and water included in rent. It is small — the bed and desk take most of it — but you cannot beat walking out the door and being in a study carrel four minutes later.',
    rentPerMonth: 890,
    bedrooms: 0,
    lat: 40.0035,
    lng: -83.0098,
  },
  {
    key: 'thornfield',
    owner: 'priya',
    title: 'Thornfield House — 4BR for a full group',
    address: '23 Thornfield Rd, Marlowe, MA',
    school: 'Marlowe College',
    description:
      'Whole house rental, best if you already have a group of four. Big front porch, two full bathrooms, and a basement that fits bikes and ski gear. Kitchen was redone a couple of years ago. It is on a corner so the front bedroom hears traffic in the morning; the back two are silent.',
    rentPerMonth: 2600,
    bedrooms: 4,
    lat: 42.3761,
    lng: -72.5223,
  },
  {
    key: 'greenhollow',
    owner: 'tobias',
    title: 'Green Hollow Apartments — 1BR, utilities included',
    address: '580 Green Hollow Dr, Marlowe, MA',
    school: 'Marlowe College',
    description:
      'One bedroom in a 30-unit complex on the shuttle line — the campus loop stops right outside and runs until 1am. Rent covers heat, water and trash. Gym in the clubhouse is small but has a squat rack. Cats allowed with a deposit, dogs are not.',
    rentPerMonth: 1420,
    bedrooms: 1,
    lat: 42.3688,
    lng: -72.5301,
  },
  {
    key: 'millrace',
    owner: 'devin',
    title: 'Millrace Loft — converted mill, exposed brick',
    address: '4 Millrace Way, Marlowe, MA',
    school: 'Marlowe College',
    description:
      'Loft in an old paper mill by the river. Fourteen-foot ceilings, original brick, enormous windows. It is genuinely a beautiful place to live and also genuinely expensive to heat in winter — budget for that. Twenty minutes to campus on foot, ten by bike along the river path.',
    rentPerMonth: 1780,
    bedrooms: 1,
    // No coordinates on purpose: exercises the "listing without a map pin" path.
  },
  {
    key: 'saltcedar',
    owner: 'sam',
    title: 'Saltcedar Commons — 3BR townhouse',
    address: '2211 Saltcedar Blvd, Fairhaven, TX',
    school: 'Fairhaven Institute of Technology',
    description:
      'Three-bedroom townhouse in a quiet development about a mile south of campus. Attached garage, small fenced yard, central AC that keeps up through August. There is a bus every fifteen minutes from the corner. Best value in the area if you can fill all three rooms.',
    rentPerMonth: 1950,
    bedrooms: 3,
    lat: 30.2807,
    lng: -97.7392,
  },
  {
    key: 'junipergate',
    owner: 'maya',
    title: 'Juniper Gate — 2BR with a real desk setup',
    address: '905 Juniper Gate, Fairhaven, TX',
    school: 'Fairhaven Institute of Technology',
    description:
      'Purpose-built student housing, so every bedroom comes with a proper desk, chair and shelving rather than an afterthought. Fiber internet is included and it is fast. The courtyard gets loud on Friday nights — ask for a unit facing the parking side if that matters to you.',
    rentPerMonth: 1520,
    bedrooms: 2,
    lat: 30.2891,
    lng: -97.7311,
  },
  {
    key: 'harborlight',
    owner: 'priya',
    title: 'Harborlight Studio — cheapest thing near campus',
    address: '18 Harborlight St, Lakeview, WI',
    school: 'Lakeview University',
    description:
      'Small studio above a hardware store. It is not fancy and the floors slope, but it is clean, dry, and the price is unbeatable for a ten-minute walk to the union. Owner is an older gentleman who does his own repairs — slow but thorough. No laundry in the building; there is a laundromat next door.',
    rentPerMonth: 745,
    bedrooms: 0,
    lat: 43.0781,
    lng: -89.4152,
  },
  {
    key: 'kestrel',
    owner: 'sam',
    title: 'Kestrel Point — lakeside 2BR with parking',
    address: '340 Kestrel Point Rd, Lakeview, WI',
    school: 'Lakeview University',
    description:
      'Two-bedroom with a partial lake view and a dedicated parking spot, which is the real selling point here in winter. Building has secure entry and a package room. Fifteen-minute walk along the lake path to the science campus, longer if you are heading to the business school.',
    rentPerMonth: 1680,
    bedrooms: 2,
    lat: 43.0724,
    lng: -89.4048,
  },
  {
    key: 'wrenfield',
    owner: 'tobias',
    title: 'Wrenfield Row — 3BR, big kitchen, older building',
    address: '61 Wrenfield Row, Lakeview, WI',
    school: 'Lakeview University',
    description:
      'Three bedrooms in a 1920s building with the enormous kitchen that implies. Great for anyone who actually cooks. Radiator heat is included and runs hot. Windows are original and single-paned, so it is drafty and you will hear the street. Management company is responsive by email, less so by phone.',
    rentPerMonth: 1490,
    bedrooms: 3,
    // No coordinates on purpose.
  },
];

/* ------------------------------- reviews -------------------------------- */
// r = [noise, landlordResponsiveness, wifi, safety, value]
const reviews = [
  // Oakline Flats
  { listing: 'oakline', author: 'noor',   r: [4, 5, 4, 5, 4], comment: 'Lived here two years. The laundry in the unit is the thing you will appreciate most in week three of the semester. Landlord replaced the fridge within four days of me emailing about it.' },
  { listing: 'oakline', author: 'devin',  r: [3, 5, 4, 4, 4], comment: 'Solid place. The street gets a bit loud on game days but that is true of the whole neighborhood. Heat works, which is more than I can say for my last apartment.' },
  { listing: 'oakline', author: 'sam',    r: [4, 4, 3, 5, 3], comment: 'Good apartment, fair price. Wifi was fine for classes but I had to run an ethernet cable to the back bedroom for anything heavy.' },

  // Brickyard Sublet
  { listing: 'brickyard', author: 'maya',  r: [4, 3, 4, 4, 5], comment: 'Took this sublet last summer and it was a great deal. Housemates kept to themselves, the backyard was genuinely nice in July. Getting the deposit back took two rounds of texting.' },
  { listing: 'brickyard', author: 'priya', r: [5, 3, 3, 4, 5], comment: 'Very quiet street. The room is big and the closet is deep. Wifi is whatever the house router is, so it slows down when everyone is home.' },

  // Pemberton Court Studio
  { listing: 'pemberton', author: 'maya',  r: [3, 4, 5, 5, 3], comment: 'The location does most of the work here. Being able to roll out of bed and be in the library is worth a lot during finals. It is small — measure your furniture first.' },
  { listing: 'pemberton', author: 'noor',  r: [2, 4, 5, 5, 3], comment: 'Building wifi is genuinely fast. The hallway carries sound though, and the door slams. Heat included is a nice buffer against the January bill.' },
  { listing: 'pemberton', author: 'tobias', r: [3, 3, 5, 4, 2], comment: 'Fine building, but you are paying a real premium for the four-minute walk. If you have a bike, look two streets over and save two hundred a month.' },

  // Thornfield House
  { listing: 'thornfield', author: 'devin', r: [3, 4, 4, 4, 5], comment: 'Split four ways this is the best value in Marlowe. The porch is where we spent every warm evening. Front bedroom really does hear the morning traffic — I would not put a light sleeper there.' },
  { listing: 'thornfield', author: 'sam',   r: [4, 4, 4, 4, 5], comment: 'Big house, works well for a group that already gets along. Two bathrooms is the difference between civil and not. Basement stayed dry all winter.' },

  // Green Hollow Apartments
  { listing: 'greenhollow', author: 'priya', r: [4, 4, 4, 5, 4], comment: 'The shuttle stop outside is the whole pitch and it delivers — I never once drove to campus. Utilities included made budgeting simple. Gym is tiny but has what you need.' },
  { listing: 'greenhollow', author: 'maya',  r: [4, 3, 4, 5, 4], comment: 'Comfortable one bedroom, well managed. Maintenance requests go through a portal and usually get handled in a couple of days. Nothing exciting, nothing wrong.' },
  { listing: 'greenhollow', author: 'noor',  r: [5, 4, 3, 5, 3], comment: 'Very quiet complex, mostly grad students. Wifi in my unit was mediocre near the bedroom. Rent crept up at renewal.' },

  // Millrace Loft
  { listing: 'millrace', author: 'priya', r: [4, 4, 5, 4, 2], comment: 'It is a stunning apartment and I would live there again, but I want to be honest about the heating bill — it was over two hundred dollars in January and February. Budget for it.' },
  { listing: 'millrace', author: 'tobias', r: [5, 4, 5, 4, 3], comment: 'The ceilings and the light are real. River path bike commute is the best part of the day. Not close enough to walk in bad weather.' },

  // Saltcedar Commons
  { listing: 'saltcedar', author: 'priya', r: [5, 4, 4, 5, 5], comment: 'Quiet development, mostly families and a few student groups. The AC handled a Texas August without complaint, which was my main worry. Garage is a genuine luxury.' },
  { listing: 'saltcedar', author: 'maya',  r: [5, 3, 4, 5, 4], comment: 'Great space for three people. Landlord is slow to respond but does fix things eventually. Bus is reliable; I only drove to campus when I was running late.' },
  { listing: 'saltcedar', author: 'devin', r: [4, 4, 4, 4, 4], comment: 'A mile out means you need a bike or the bus, but the tradeoff is a real yard and a real garage. Would recommend for a group of three that wants space.' },

  // Juniper Gate
  { listing: 'junipergate', author: 'sam',   r: [2, 4, 5, 4, 4], comment: 'The included fiber is not marketing — I got the full speed consistently. The courtyard noise on weekends is also not exaggerated. Ask for a parking-side unit.' },
  { listing: 'junipergate', author: 'tobias', r: [3, 5, 5, 4, 4], comment: 'Front desk actually answers and maintenance shows up same day. Having a real desk and chair already in the room saved me a whole weekend of furniture shopping.' },
  { listing: 'junipergate', author: 'devin',  r: [2, 4, 5, 4, 3], comment: 'Good building, well run, a little pricey for what it is. If you are a light sleeper this is not the place unless you get a quiet-side unit.' },

  // Harborlight Studio
  { listing: 'harborlight', author: 'sam',    r: [3, 4, 3, 4, 5], comment: 'Cheapest legitimate place I found within walking distance, and it was clean and dry the whole year. Floors do slope — my desk chair rolled. Laundromat next door is fine.' },
  { listing: 'harborlight', author: 'noor',   r: [3, 5, 2, 4, 5], comment: 'The owner fixed my radiator himself on a Sunday. Wifi is the weak point, I ended up paying for my own line. For the price I have no real complaints.' },
  { listing: 'harborlight', author: 'tobias', r: [2, 4, 3, 3, 5], comment: 'You hear the hardware store loading dock in the morning. Everything else about it is honest value. Good first apartment.' },

  // Kestrel Point
  { listing: 'kestrel', author: 'priya', r: [4, 4, 4, 5, 4], comment: 'The parking spot is worth more than the lake view in February. Secure entry and a package room meant nothing ever went missing. Walk to the science campus is pleasant.' },
  { listing: 'kestrel', author: 'maya',  r: [4, 3, 5, 5, 3], comment: 'Nice building, good internet, safe. Management took about a week to respond to a leaky faucet. Rent is at the top of what I would pay here.' },
  { listing: 'kestrel', author: 'noor',  r: [5, 4, 4, 5, 4], comment: 'Very quiet, lots of grad students. The lake path commute in fall is genuinely lovely. Business school walk is more like twenty-five minutes, not fifteen.' },

  // Wrenfield Row
  { listing: 'wrenfield', author: 'sam',   r: [2, 3, 4, 4, 4], comment: 'The kitchen is the reason to live here — three of us cooked constantly and never got in each other way. The windows are as drafty as advertised. Email the management company, do not call.' },
  { listing: 'wrenfield', author: 'devin', r: [2, 3, 4, 4, 4], comment: 'Old building charm with old building problems. Heat is included and runs hot enough that the drafts did not actually matter much. Street noise is real.' },
  { listing: 'wrenfield', author: 'maya',  r: [3, 2, 3, 4, 3], comment: 'Good bones, slow management. Took three weeks and several emails to get a broken window latch replaced. The kitchen almost makes up for it.' },
];

/* -------------------------------- run ----------------------------------- */
async function seed() {
  const force = process.argv.includes('--force');
  if (process.env.NODE_ENV === 'production' && !force) {
    console.error(
      '\n[seed] Refusing to run with NODE_ENV=production.\n' +
        '[seed] This deletes all users, listings and reviews. Re-run with --force if you are sure.\n'
    );
    process.exit(1);
  }

  await connectDB();
  console.log(`[seed] target database: ${mongoose.connection.name}`);
  console.log('[seed] wiping users, listings and reviews...');

  await Promise.all([
    Review.deleteMany({}),
    Listing.deleteMany({}),
    User.deleteMany({}),
  ]);

  // Make sure the unique indexes exist on a fresh database.
  await Promise.all([
    User.syncIndexes(),
    Listing.syncIndexes(),
    Review.syncIndexes(),
  ]);

  const passwordHash = await User.hashPassword(DEMO_PASSWORD);
  const createdUsers = await User.create(
    users.map(({ key, ...u }) => ({ ...u, passwordHash })) // eslint-disable-line no-unused-vars
  );
  const userByKey = Object.fromEntries(users.map((u, i) => [u.key, createdUsers[i]]));
  console.log(`[seed] created ${createdUsers.length} users`);

  const createdListings = await Listing.create(
    listings.map(({ key, owner, ...l }) => ({ ...l, createdBy: userByKey[owner]._id })) // eslint-disable-line no-unused-vars
  );
  const listingByKey = Object.fromEntries(listings.map((l, i) => [l.key, createdListings[i]]));
  console.log(`[seed] created ${createdListings.length} listings`);

  const reviewDocs = reviews.map(({ listing, author, r, comment }) => {
    const [noise, landlordResponsiveness, wifi, safety, value] = r;
    const owner = listingByKey[listing].createdBy.toString();
    if (owner === userByKey[author]._id.toString()) {
      throw new Error(`Seed error: ${author} owns listing "${listing}" and cannot review it.`);
    }
    return {
      listing: listingByKey[listing]._id,
      author: userByKey[author]._id,
      ratings: { noise, landlordResponsiveness, wifi, safety, value },
      comment,
    };
  });

  const createdReviews = await Review.create(reviewDocs);
  console.log(`[seed] created ${createdReviews.length} reviews`);

  const schools = [...new Set(listings.map((l) => l.school))];
  console.log('\n[seed] Done. Schools you can search for:');
  schools.forEach((s) => console.log(`         - ${s}`));
  console.log('\n[seed] Demo logins (all use the same password):');
  users.slice(0, 3).forEach((u) => console.log(`         ${u.email}  /  ${DEMO_PASSWORD}`));
  console.log('');

  await disconnectDB();
}

seed().catch(async (err) => {
  console.error('\n[seed] Failed:', err.message);
  if (err.errors) console.error(err.errors);
  await disconnectDB().catch(() => {});
  process.exit(1);
});

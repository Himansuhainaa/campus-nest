/**
 * Seeds CampusNest with demo users, listings and reviews.
 *
 *   npm run seed
 *
 * WARNING: this wipes the User, Listing and Review collections in the database
 * that MONGODB_URI points at. It refuses to run when NODE_ENV=production unless
 * you pass --force.
 *
 * ---------------------------------------------------------------------------
 * ABOUT THIS DATA
 *
 * The cities, neighbourhoods, colleges and coordinates are real, so the map and
 * the school search behave like the finished product. Every PROPERTY NAME is
 * invented, and so is every review.
 *
 * That line is deliberate. Reviews here are critical of landlords, deposits and
 * maintenance. Attaching that to a real, findable business — one that never
 * agreed to be listed and whose reviews were written by nobody — is defamation
 * risk with no upside. Invented names carry none of that and look identical to
 * a visitor.
 *
 * Replace this with real listings you have gathered yourself before inviting
 * real users; sample data is for making an empty site legible, not for traction.
 * ------------------------------------------------------------------------- */
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
  { key: 'ananya', name: 'Ananya Iyer',    email: 'ananya@campusnest.dev',  school: 'Savitribai Phule Pune University' },
  { key: 'rohan',  name: 'Rohan Deshmukh', email: 'rohan@campusnest.dev',   school: 'Bangalore University' },
  { key: 'fatima', name: 'Fatima Sheikh',  email: 'fatima@campusnest.dev',  school: 'University of Delhi' },
  { key: 'karthik', name: 'Karthik Menon', email: 'karthik@campusnest.dev', school: 'Anna University' },
  { key: 'ishita', name: 'Ishita Bose',    email: 'ishita@campusnest.dev',  school: 'Savitribai Phule Pune University' },
  { key: 'aditya', name: 'Aditya Rane',    email: 'aditya@campusnest.dev',  school: 'Bangalore University' },
];

/* ------------------------------ listings -------------------------------- */
// Real areas and colleges. Invented building names.
const listings = [
  {
    key: 'kothrud2bhk',
    owner: 'ananya',
    title: 'Sunhaven Residency — 2BHK, walk to Kothrud depot',
    address: 'Lane 4, Dahanukar Colony, Kothrud, Pune 411038',
    school: 'Savitribai Phule Pune University',
    description:
      'Two-bedroom flat on the third floor of a small society in Dahanukar Colony. Ten minutes on foot to Kothrud depot, so buses to anywhere in Pune are easy. Society has covered two-wheeler parking and a watchman until 10pm. Water supply is twice a day and has never failed in two years. Owner lives in Baner and visits maybe once a month.',
    rentPerMonth: 22000,
    bedrooms: 2,
    lat: 18.5074,
    lng: 73.8077,
  },
  {
    key: 'karvenagarpg',
    owner: 'ishita',
    title: 'Meghdoot Girls PG — single room with attached bath',
    address: 'Near Cummins College, Karvenagar, Pune 411052',
    school: 'Savitribai Phule Pune University',
    description:
      'Single occupancy room in a girls-only PG, five minutes from Cummins. Attached bathroom with a geyser that works. Rent includes two meals on weekdays and breakfast on weekends; the food is homely North Indian, not hostel mess food. Gate closes at 10:30pm, which is strict and non-negotiable. Wi-Fi is included but shared across sixteen rooms.',
    rentPerMonth: 11500,
    bedrooms: 1,
    lat: 18.4869,
    lng: 73.8203,
  },
  {
    key: 'aundhstudio',
    owner: 'aditya',
    title: 'Parijat Studio — furnished, above a bakery in Aundh',
    address: 'ITI Road, Aundh, Pune 411007',
    school: 'Savitribai Phule Pune University',
    description:
      'Compact furnished studio on ITI Road. Bed, wardrobe, study table and a small kitchenette all included, so you move in with a suitcase. The bakery downstairs means the stairwell smells like bread every morning and there is noise from 6am deliveries. Very well connected — autos are always available and Aundh has everything within walking distance.',
    rentPerMonth: 15000,
    bedrooms: 0,
    lat: 18.5590,
    lng: 73.8078,
  },
  {
    key: 'koramangala3bhk',
    owner: 'rohan',
    title: 'Neelkanth Nivas — 3BHK for a group, 5th Block',
    address: '5th Block, Koramangala, Bengaluru 560095',
    school: 'Bangalore University',
    description:
      'Three-bedroom independent floor in 5th Block. Best if you already have a group of three. Big shared balcony, borewell plus Cauvery water, and a landlord who lives on the ground floor and is genuinely reasonable. Rent is high but you are in Koramangala — everything is a walk away. Two-wheeler parking for three, no car parking.',
    rentPerMonth: 48000,
    bedrooms: 3,
    lat: 12.9345,
    lng: 77.6265,
  },
  {
    key: 'btmpg',
    owner: 'karthik',
    title: 'Sapphire Co-living — twin sharing in BTM Layout',
    address: '2nd Stage, BTM Layout, Bengaluru 560076',
    school: 'Bangalore University',
    description:
      'Twin-sharing room in a co-living building. Rent covers electricity, cleaning twice a week, and a decent gym in the basement. Fibre internet is genuinely fast. The building is full of working professionals rather than students, so it is quiet on weeknights. Deposit is two months and they do return it, but it takes about six weeks.',
    rentPerMonth: 13500,
    bedrooms: 1,
    lat: 12.9166,
    lng: 77.6101,
  },
  {
    key: 'jayanagar1bhk',
    owner: 'aditya',
    title: 'Ashirwad Nilaya — 1BHK near Jayanagar 4th Block',
    address: '4th Block, Jayanagar, Bengaluru 560011',
    school: 'Bangalore University',
    description:
      'One-bedroom on the first floor of an old independent house. High ceilings, proper cross-ventilation, and a small balcony that gets morning sun. It is an older building so the plumbing occasionally complains, but the owner fixes things within a day or two. Jayanagar 4th Block market is a ten-minute walk.',
    rentPerMonth: 19000,
    bedrooms: 1,
    // No coordinates on purpose: exercises the "listing without a map pin" path.
  },
  {
    key: 'mukherjeenagar',
    owner: 'fatima',
    title: 'Vidya Bhawan — single room, Mukherjee Nagar',
    address: 'Batra Cinema Road, Mukherjee Nagar, Delhi 110009',
    school: 'University of Delhi',
    description:
      'Single room in a building full of students preparing for exams, so it is silent from about 9pm onward. Room is small but has a proper study table, a fan and a window. Shared bathroom on each floor, cleaned daily. Inverter backup covers the lights and fan during cuts. Coaching centres and cheap food are all within five minutes.',
    rentPerMonth: 9500,
    bedrooms: 1,
    lat: 28.7041,
    lng: 77.2100,
  },
  {
    key: 'hudsonlines',
    owner: 'ananya',
    title: 'Shanti Kunj — 2BHK share near North Campus',
    address: 'Hudson Lane, GTB Nagar, Delhi 110009',
    school: 'University of Delhi',
    description:
      'Two-bedroom flat on Hudson Lane, which means you are surrounded by cafes and a two-minute walk from GTB Nagar metro. Convenient beyond belief and loud until midnight on weekends. Flat itself is well maintained with a proper kitchen. Landlord is fine about visitors, strict about the rent date.',
    rentPerMonth: 32000,
    bedrooms: 2,
    lat: 28.6996,
    lng: 77.2054,
  },
  {
    key: 'satyaniketan',
    owner: 'karthik',
    title: 'Rosewood Apartments — 1BHK, Satya Niketan',
    address: 'Satya Niketan, South Campus, Delhi 110021',
    school: 'University of Delhi',
    description:
      'One-bedroom in a newer building in Satya Niketan, walking distance to South Campus colleges. Power backup for the whole flat, which matters in a Delhi summer. Reasonably quiet given the location. The main downside is the price — you are paying for the postcode, not the flat.',
    rentPerMonth: 27000,
    bedrooms: 1,
    lat: 28.5885,
    lng: 77.1668,
  },
  {
    key: 'guindypg',
    owner: 'rohan',
    title: 'Marina Men’s PG — twin sharing near Guindy',
    address: 'Ekkatuthangal, Guindy, Chennai 600032',
    school: 'Anna University',
    description:
      'Twin sharing in a men’s PG about fifteen minutes from Anna University by bus. Three meals included and the food is properly South Indian — sambar that tastes like someone’s mother made it. Rooms have AC but it is metered separately. Guindy metro is close, which makes the rest of Chennai reachable.',
    rentPerMonth: 8500,
    bedrooms: 1,
    lat: 13.0067,
    lng: 80.2206,
  },
  {
    key: 'velachery2bhk',
    owner: 'fatima',
    title: 'Kadambari Flats — 2BHK with covered parking',
    address: 'Velachery Main Road, Chennai 600042',
    school: 'Anna University',
    description:
      'Two-bedroom flat in a gated apartment block on Velachery Main Road. Covered parking, lift, and a genuine security desk. The building has a generator, so power cuts are a non-event. Velachery floods in a heavy monsoon — this block is on higher ground and has not, but ask neighbours before you sign anywhere in this area.',
    rentPerMonth: 24000,
    bedrooms: 2,
    lat: 12.9756,
    lng: 80.2207,
  },
  {
    key: 'adyarshare',
    owner: 'ishita',
    title: 'Sea Breeze Annexe — single room in Adyar',
    address: 'Gandhi Nagar, Adyar, Chennai 600020',
    school: 'Anna University',
    description:
      'Single room in the annexe of a family house in Gandhi Nagar. Separate entrance so you come and go freely, but the owners are next door and it is a family setting — no late-night gatherings. Quiet, leafy street. Beach is a twenty-minute walk. Rent includes water; electricity is on your own meter.',
    rentPerMonth: 12000,
    bedrooms: 1,
    // No coordinates on purpose.
  },
];

/* ------------------------------- reviews -------------------------------- */
// r = [noise, landlordResponsiveness, wifi, safety, value]
const reviews = [
  { listing: 'kothrud2bhk', author: 'ishita', r: [4, 4, 4, 5, 4], comment: 'Lived here two years with a flatmate. The location is the real value — you can get anywhere in Pune from Kothrud depot without ever needing a cab. Water pressure on the third floor is fine, which is not a given around here.' },
  { listing: 'kothrud2bhk', author: 'rohan',  r: [3, 4, 4, 5, 4], comment: 'Solid society, decent neighbours, watchman actually pays attention. Gets a bit loud during Ganpati but that is all of Pune. Owner returned the full deposit without any argument, which surprised me.' },
  { listing: 'kothrud2bhk', author: 'karthik', r: [4, 3, 3, 5, 3], comment: 'Good flat overall. Wi-Fi depends on whichever provider you pick, the building has no arrangement. Took about ten days to get a leaking tap fixed.' },

  { listing: 'karvenagarpg', author: 'ananya', r: [4, 4, 3, 5, 5], comment: 'Stayed here through my second year. The food genuinely made the difference — after a long day you are not hunting for dinner. The 10:30 gate rule is real and they do not bend it, so know that before you sign.' },
  { listing: 'karvenagarpg', author: 'fatima', r: [5, 4, 2, 5, 4], comment: 'Very safe, which is why my parents agreed. Rooms are clean and the attached bathroom is worth the extra rent. Wi-Fi struggles at night when everyone is online — I ended up using mobile data for classes.' },

  { listing: 'aundhstudio', author: 'ananya', r: [2, 4, 5, 4, 3], comment: 'Furnished really does mean furnished, I moved in with one suitcase. But the bakery deliveries start at 6am and you will hear every crate. If you are a light sleeper this is not your place.' },
  { listing: 'aundhstudio', author: 'fatima', r: [3, 5, 5, 4, 3], comment: 'Owner responds on WhatsApp within an hour, which is rare. Internet is properly fast. Aundh is expensive for what you get, but everything you need is within walking distance.' },
  { listing: 'aundhstudio', author: 'rohan',  r: [2, 4, 5, 4, 2], comment: 'Fine studio, well located, overpriced. If you have a two-wheeler, look in Baner and save five thousand a month.' },

  { listing: 'koramangala3bhk', author: 'ananya', r: [3, 5, 4, 4, 4], comment: 'Split three ways this is defensible for Koramangala. Landlord living downstairs sounds intrusive but he is genuinely helpful and fixes things the same week. Balcony is where we spent every evening.' },
  { listing: 'koramangala3bhk', author: 'ishita', r: [3, 5, 4, 4, 3], comment: 'Great flat, brutal rent. Water was never an issue even in April, which is more than my previous place in HSR managed. No car parking is worth knowing if anyone in your group drives.' },

  { listing: 'btmpg', author: 'ananya', r: [4, 4, 5, 5, 4], comment: 'The fibre is not marketing, I got full speed consistently through a year of online classes. Mostly working professionals here so weeknights are quiet. Deposit came back in about six weeks as promised.' },
  { listing: 'btmpg', author: 'fatima', r: [4, 3, 5, 5, 4], comment: 'Clean, well run, gym is small but has the basics. Support is via an app which is efficient but impersonal. Electricity being separate adds up in summer.' },
  { listing: 'btmpg', author: 'ishita', r: [5, 4, 5, 5, 3], comment: 'Quiet building, safe at any hour, good internet. Twin sharing means you are dependent on getting a decent roommate — mine was fine, others were not so lucky.' },

  { listing: 'jayanagar1bhk', author: 'rohan',  r: [4, 4, 3, 5, 4], comment: 'Old house charm with old house plumbing. Ceilings and ventilation mean you barely need a fan until April. Owner is elderly and does repairs himself, so slow but thorough.' },
  { listing: 'jayanagar1bhk', author: 'karthik', r: [5, 4, 3, 5, 4], comment: 'Lovely quiet street, morning sun in the balcony, market ten minutes away. No lift and it is the first floor, which matters if you are hauling groceries.' },

  { listing: 'mukherjeenagar', author: 'ananya', r: [5, 4, 3, 4, 5], comment: 'If you are preparing for an exam this is exactly the environment you want — the whole building goes silent by nine. Room is small, but the study table is proper and the chair does not wreck your back.' },
  { listing: 'mukherjeenagar', author: 'karthik', r: [5, 4, 2, 4, 5], comment: 'Cheapest genuinely liveable room I found in Mukherjee Nagar. Shared bathroom is cleaned every day without fail. Wi-Fi is weak, most people buy their own dongle.' },
  { listing: 'mukherjeenagar', author: 'aditya', r: [4, 3, 2, 4, 4], comment: 'Good value and a serious atmosphere. Inverter covers lights and fan only, so summer afternoons during a cut are rough. Landlord is fair but not fast.' },

  { listing: 'hudsonlines', author: 'rohan',  r: [2, 4, 4, 4, 4], comment: 'Two minutes from the metro and surrounded by places to eat — unbeatable for North Campus. The flip side is noise until midnight on weekends. Flat itself is genuinely well maintained.' },
  { listing: 'hudsonlines', author: 'karthik', r: [2, 3, 4, 4, 3], comment: 'Location is the whole product. Kitchen is proper and we cooked most nights. Landlord is relaxed about guests and inflexible about the rent date — pay on the first.' },

  { listing: 'satyaniketan', author: 'aditya', r: [4, 4, 4, 5, 3], comment: 'Power backup for the entire flat is the reason to pick this over cheaper options nearby. Walk to South Campus is short and safe even late. You are paying a Satya Niketan premium though.' },
  { listing: 'satyaniketan', author: 'ishita', r: [4, 4, 4, 5, 3], comment: 'Newer building so everything works. Quieter than I expected for the area. Would recommend if the budget stretches, otherwise look one lane further out.' },

  { listing: 'guindypg', author: 'ananya', r: [3, 4, 3, 4, 5], comment: 'The food is the reason to stay here. Three proper meals, and the sambar is genuinely good. AC metered separately catches people out — budget for it in summer.' },
  { listing: 'guindypg', author: 'ishita', r: [3, 4, 3, 4, 5], comment: 'Well run and cheap for Chennai. Guindy metro nearby makes the city accessible. Rooms are basic but clean and the staff are decent people.' },
  { listing: 'guindypg', author: 'fatima', r: [2, 3, 3, 4, 4], comment: 'Value is excellent. It is on a main road so there is constant traffic noise — ask for a room facing the back.' },

  { listing: 'velachery2bhk', author: 'rohan',  r: [4, 4, 4, 5, 4], comment: 'Generator means power cuts simply do not affect you, which in Chennai is worth real money. Covered parking and a proper security desk. Ask about flooding history for any place in Velachery — this block was fine.' },
  { listing: 'velachery2bhk', author: 'aditya', r: [4, 3, 4, 5, 4], comment: 'Comfortable flat in a well-run block. Lift works, security is attentive. Management responds through the association, so anything shared takes a while to move.' },

  { listing: 'adyarshare', author: 'rohan',  r: [5, 5, 3, 5, 4], comment: 'Quiet leafy street and the owners are lovely people who leave you alone but are there if something breaks. Separate entrance means it never feels like living with a family. Beach walk on Sundays.' },
  { listing: 'adyarshare', author: 'aditya', r: [5, 5, 2, 5, 4], comment: 'Very safe and very calm. No Wi-Fi arrangement so plan your own connection. It is a family house, so no late gatherings — that was clear from the start and honestly kept the place peaceful.' },
];

/* ------------------------------- images --------------------------------- */
// Free, commercially-licensed stock interiors from Unsplash (no attribution
// required, hotlinkable via their CDN). These are GENERIC rooms attached to
// INVENTED listings — never a real property's own photo, which would both
// infringe copyright and misrepresent a real business. Each URL was verified
// to return a real image and visually confirmed to be a room/flat/building.
const U = (id) =>
  `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

const imagesByKey = {
  kothrud2bhk: [U('1522708323590-d24dbb6b0267'), U('1484154218962-a197022b5858')],
  karvenagarpg: [U('1522771739844-6a9f6d5f14af')],
  aundhstudio: [U('1493809842364-78817add7ffb')],
  koramangala3bhk: [U('1560448204-e02f11c3d0e2'), U('1554995207-c18c203602cb')],
  // Twin-sharing / co-living PGs get actual hostel-dorm photos (bunk beds).
  btmpg: [U('1709805619372-40de3f158e83')],
  jayanagar1bhk: [U('1502672260266-1c1ef2d93688')],
  mukherjeenagar: [U('1556020685-ae41abfc9365')],
  hudsonlines: [U('1567767292278-a4f21aa2d36e')],
  satyaniketan: [U('1560185007-c5ca9d2c014d')],
  guindypg: [U('1768289269971-6171457bed13')],
  velachery2bhk: [U('1502005229762-cf1b2da7c5d6')],
  adyarshare: [U('1631049307264-da0ec9d70304')],
};

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
    users.map(({ key, ...u }) => ({ ...u, passwordHash, emailVerified: true })) // eslint-disable-line no-unused-vars
  );
  const userByKey = Object.fromEntries(users.map((u, i) => [u.key, createdUsers[i]]));
  console.log(`[seed] created ${createdUsers.length} users`);

  const createdListings = await Listing.create(
    listings.map(({ key, owner, ...l }) => ({
      ...l,
      images: imagesByKey[key] || [],
      createdBy: userByKey[owner]._id,
    }))
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
  console.log(
    '\n[seed] Property names and reviews are invented. Cities, areas and colleges are real.'
  );
  console.log('');

  await disconnectDB();
}

seed().catch(async (err) => {
  console.error('\n[seed] Failed:', err.message);
  if (err.errors) console.error(err.errors);
  await disconnectDB().catch(() => {});
  process.exit(1);
});

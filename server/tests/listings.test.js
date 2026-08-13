import { beforeEach, describe, expect, it } from 'vitest';
import {
  app,
  request,
  registerUser,
  createListing,
  createReview,
  listingPayload,
  pngBuffer,
  uploadedFileExists,
} from './helpers.js';

describe('GET /api/listings — filtering and sorting', () => {
  let owner;
  let reviewers;

  beforeEach(async () => {
    owner = await registerUser();
    reviewers = [await registerUser(), await registerUser()];

    // Three listings across two schools, with different rents and ratings.
    const cheap = await createListing(owner.token, {
      title: 'Cheap Studio',
      school: 'Marlowe College',
      rentPerMonth: 600,
    });
    const mid = await createListing(owner.token, {
      title: 'Mid Range Two Bed',
      school: 'Marlowe College',
      rentPerMonth: 1400,
    });
    const pricey = await createListing(owner.token, {
      title: 'Pricey Loft',
      school: 'Kingsley State University',
      rentPerMonth: 2200,
    });

    // cheap -> 2.0 overall, mid -> 5.0 overall, pricey -> no reviews
    await createReview(reviewers[0].token, cheap._id, {
      ratings: { noise: 2, landlordResponsiveness: 2, wifi: 2, safety: 2, value: 2 },
    });
    await createReview(reviewers[0].token, mid._id, {
      ratings: { noise: 5, landlordResponsiveness: 5, wifi: 5, safety: 5, value: 5 },
    });
    await createReview(reviewers[1].token, mid._id, {
      ratings: { noise: 5, landlordResponsiveness: 5, wifi: 5, safety: 5, value: 5 },
    });
  });

  it('returns every listing with a computed rating summary', async () => {
    const res = await request(app).get('/api/listings');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(typeof res.body.listings[0].ratingSummary.overall).toBe('number');
    expect(Object.keys(res.body.listings[0].ratingSummary.categories)).toHaveLength(5);
  });

  it('populates createdBy without leaking the password hash', async () => {
    const res = await request(app).get('/api/listings');
    const [listing] = res.body.listings;

    expect(listing.createdBy.name).toBe('Test Student');
    expect(listing.createdBy.passwordHash).toBeUndefined();
  });

  it('zeroes the summary for a listing with no reviews', async () => {
    const res = await request(app).get('/api/listings?school=Kingsley');
    const [pricey] = res.body.listings;

    expect(pricey.ratingSummary.count).toBe(0);
    expect(pricey.ratingSummary.overall).toBe(0);
    expect(pricey.ratingSummary.categories.noise).toBe(0);
  });

  it('filters by school case-insensitively and partially', async () => {
    const res = await request(app).get('/api/listings?school=marlowe');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.listings.every((l) => l.school === 'Marlowe College')).toBe(true);
  });

  it('returns an empty array when nothing matches the school', async () => {
    const res = await request(app).get('/api/listings?school=Nonexistent%20College');

    expect(res.status).toBe(200);
    expect(res.body.listings).toEqual([]);
  });

  it('treats regex characters in the school filter as literals', async () => {
    const res = await request(app).get('/api/listings?school=.*');

    // If the input were interpolated raw, this would match everything.
    expect(res.body.count).toBe(0);
  });

  it('sorts by price ascending', async () => {
    const res = await request(app).get('/api/listings?sort=price');
    const prices = res.body.listings.map((l) => l.rentPerMonth);

    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(prices[0]).toBe(600);
  });

  it('sorts by rating descending', async () => {
    const res = await request(app).get('/api/listings?sort=rating');
    const overalls = res.body.listings.map((l) => l.ratingSummary.overall);

    expect(overalls).toEqual([...overalls].sort((a, b) => b - a));
    expect(overalls[0]).toBe(5);
  });

  it('sorts by newest', async () => {
    const res = await request(app).get('/api/listings?sort=newest');
    const dates = res.body.listings.map((l) => new Date(l.createdAt).getTime());

    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('rejects an unknown sort key', async () => {
    const res = await request(app).get('/api/listings?sort=bogus');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sort must be one of/i);
  });

  it('filters by minRating in the database', async () => {
    const res = await request(app).get('/api/listings?minRating=4');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.listings[0].title).toBe('Mid Range Two Bed');
  });

  it('rejects a minRating outside 0–5', async () => {
    const res = await request(app).get('/api/listings?minRating=9');
    expect(res.status).toBe(400);
  });

  it('honours limit', async () => {
    const res = await request(app).get('/api/listings?limit=2');
    expect(res.body.listings).toHaveLength(2);
  });

  it('filters by createdBy', async () => {
    const other = await registerUser();
    await createListing(other.token, { title: 'Someone Elses Place' });

    const res = await request(app).get(`/api/listings?createdBy=${other.user._id}`);

    expect(res.body.count).toBe(1);
    expect(res.body.listings[0].title).toBe('Someone Elses Place');
  });

  it('rejects a malformed createdBy', async () => {
    const res = await request(app).get('/api/listings?createdBy=not-an-id');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/listings/:id', () => {
  it('returns the listing with populated reviews and averages', async () => {
    const owner = await registerUser();
    const reviewer = await registerUser();
    const listing = await createListing(owner.token);
    await createReview(reviewer.token, listing._id, {
      ratings: { noise: 3, landlordResponsiveness: 5, wifi: 4, safety: 5, value: 3 },
    });

    const res = await request(app).get(`/api/listings/${listing._id}`);

    expect(res.status).toBe(200);
    expect(res.body.listing.reviews).toHaveLength(1);
    expect(res.body.listing.reviews[0].author.name).toBe('Test Student');
    expect(res.body.listing.ratingSummary.count).toBe(1);
    expect(res.body.listing.ratingSummary.overall).toBe(4);
    expect(res.body.listing.ratingSummary.categories.landlordResponsiveness).toBe(5);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/api/listings/000000000000000000000000');
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/listings/not-an-object-id');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not valid/i);
  });
});

describe('POST /api/listings — validation', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/listings').send(listingPayload());
    expect(res.status).toBe(401);
  });

  it.each([
    ['a short title', { title: 'ab' }, /at least 3/],
    ['a negative rent', { rentPerMonth: -50 }, /at least 1/],
    ['a zero rent', { rentPerMonth: 0 }, /required|at least 1/],
    ['fractional bedrooms', { bedrooms: 2.5 }, /whole number/],
    ['a short description', { description: 'too short' }, /at least 20/],
  ])('rejects %s', async (_label, override, pattern) => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(listingPayload(override));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(pattern);
  });

  it('accepts a high-end metro rent in rupees', async () => {
    // Prices are rupees; ₹1,20,000/month is a realistic upper-market flat and
    // must not be rejected the way the old USD-scale 100000 ceiling did.
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(listingPayload({ rentPerMonth: 120000 }));

    expect(res.status).toBe(201);
    expect(res.body.listing.rentPerMonth).toBe(120000);
  });

  it('still rejects an absurd rent above the ceiling', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(listingPayload({ rentPerMonth: 5000000 }));

    expect(res.status).toBe(400);
  });

  it('rejects latitude without longitude', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(listingPayload({ lat: 40.001 }));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/together/);
  });

  it('rejects an out-of-range latitude', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(listingPayload({ lat: 200, lng: 10 }));

    expect(res.status).toBe(400);
  });

  it('creates a listing with coordinates', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(listingPayload({ lat: 40.0011, lng: -83.0122 }));

    expect(res.status).toBe(201);
    expect(res.body.listing.lat).toBe(40.0011);
    expect(res.body.listing.hasCoordinates).toBe(true);
    expect(res.body.listing.ratingSummary).toEqual({
      count: 0,
      overall: 0,
      categories: { noise: 0, landlordResponsiveness: 0, wifi: 0, safety: 0, value: 0 },
    });
  });
});

describe('POST /api/listings — image upload', () => {
  it('accepts up to 5 images and serves them statically', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Place With Photos')
      .field('address', '1 Test Street, Testville, OH')
      .field('school', 'Test University')
      .field('description', 'A description that is comfortably longer than twenty characters.')
      .field('rentPerMonth', '1200')
      .field('bedrooms', '2')
      .attach('images', pngBuffer(), 'one.png')
      .attach('images', pngBuffer(), 'two.png');

    expect(res.status).toBe(201);
    expect(res.body.listing.images).toHaveLength(2);

    const served = await request(app).get(res.body.listing.images[0]);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toMatch(/image\/png/);
  });

  it('404s for a missing image instead of crashing', async () => {
    const res = await request(app).get('/uploads/does-not-exist.png');
    expect(res.status).toBe(404);
  });

  it('rejects a non-image upload', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Bad File Type')
      .field('address', '1 Test Street, Testville, OH')
      .field('school', 'Test University')
      .field('description', 'A description that is comfortably longer than twenty characters.')
      .field('rentPerMonth', '900')
      .field('bedrooms', '1')
      .attach('images', Buffer.from('not an image'), 'bad.txt');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/JPG|PNG/i);
  });

  it('rejects more than 5 images', async () => {
    const { token } = await registerUser();
    const req = request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Too Many Photos')
      .field('address', '1 Test Street, Testville, OH')
      .field('school', 'Test University')
      .field('description', 'A description that is comfortably longer than twenty characters.')
      .field('rentPerMonth', '900')
      .field('bedrooms', '1');

    for (let i = 0; i < 6; i += 1) req.attach('images', pngBuffer(), `f${i}.png`);

    const res = await req;
    expect(res.status).toBe(400);
  });

  it('does not leave orphaned files when validation fails after upload', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'ab') // too short — fails after multer has written the file
      .field('address', '1 Test Street, Testville, OH')
      .field('school', 'Test University')
      .field('description', 'A description that is comfortably longer than twenty characters.')
      .field('rentPerMonth', '900')
      .field('bedrooms', '1')
      .attach('images', pngBuffer(), 'orphan.png');

    expect(res.status).toBe(400);

    const { readdirSync } = await import('node:fs');
    expect(readdirSync(process.env.UPLOAD_DIR)).toHaveLength(0);
  });
});

describe('PUT /api/listings/:id', () => {
  it('returns 403 for a non-owner', async () => {
    const owner = await registerUser();
    const stranger = await registerUser();
    const listing = await createListing(owner.token);

    const res = await request(app)
      .put(`/api/listings/${listing._id}`)
      .set('Authorization', stranger.auth)
      .send({ rentPerMonth: 1 });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/only the person who posted/i);
  });

  it('updates fields for the owner', async () => {
    const owner = await registerUser();
    const listing = await createListing(owner.token);

    const res = await request(app)
      .put(`/api/listings/${listing._id}`)
      .set('Authorization', owner.auth)
      .send({ rentPerMonth: 1111, title: 'Renamed Apartment' });

    expect(res.status).toBe(200);
    expect(res.body.listing.rentPerMonth).toBe(1111);
    expect(res.body.listing.title).toBe('Renamed Apartment');
  });

  it('still validates on update', async () => {
    const owner = await registerUser();
    const listing = await createListing(owner.token);

    const res = await request(app)
      .put(`/api/listings/${listing._id}`)
      .set('Authorization', owner.auth)
      .send({ rentPerMonth: 0 });

    expect(res.status).toBe(400);
  });

  it('clears coordinates when both are sent blank', async () => {
    const owner = await registerUser();
    const listing = await createListing(owner.token, { lat: 40.1, lng: -83.1 });

    const res = await request(app)
      .put(`/api/listings/${listing._id}`)
      .set('Authorization', owner.auth)
      .send({ lat: '', lng: '' });

    expect(res.status).toBe(200);
    expect(res.body.listing.lat).toBeNull();
    expect(res.body.listing.hasCoordinates).toBe(false);
  });

  it('keeps existing images when keepImages is omitted', async () => {
    const owner = await registerUser();
    const created = await request(app)
      .post('/api/listings')
      .set('Authorization', owner.auth)
      .field('title', 'Place With Photos')
      .field('address', '1 Test Street, Testville, OH')
      .field('school', 'Test University')
      .field('description', 'A description that is comfortably longer than twenty characters.')
      .field('rentPerMonth', '1200')
      .field('bedrooms', '2')
      .attach('images', pngBuffer(), 'one.png')
      .attach('images', pngBuffer(), 'two.png');

    const res = await request(app)
      .put(`/api/listings/${created.body.listing._id}`)
      .set('Authorization', owner.auth)
      .send({ rentPerMonth: 1300 });

    expect(res.body.listing.images).toHaveLength(2);
  });

  it('drops removed images and deletes them from disk', async () => {
    const owner = await registerUser();
    const created = await request(app)
      .post('/api/listings')
      .set('Authorization', owner.auth)
      .field('title', 'Place With Photos')
      .field('address', '1 Test Street, Testville, OH')
      .field('school', 'Test University')
      .field('description', 'A description that is comfortably longer than twenty characters.')
      .field('rentPerMonth', '1200')
      .field('bedrooms', '2')
      .attach('images', pngBuffer(), 'one.png')
      .attach('images', pngBuffer(), 'two.png');

    const [keep, drop] = created.body.listing.images;

    const res = await request(app)
      .put(`/api/listings/${created.body.listing._id}`)
      .set('Authorization', owner.auth)
      .field('keepImages', JSON.stringify([keep]));

    expect(res.body.listing.images).toEqual([keep]);
    expect(uploadedFileExists(keep)).toBe(true);
    expect(uploadedFileExists(drop)).toBe(false);
  });
});

describe('DELETE /api/listings/:id', () => {
  it('returns 403 for a non-owner', async () => {
    const owner = await registerUser();
    const stranger = await registerUser();
    const listing = await createListing(owner.token);

    const res = await request(app)
      .delete(`/api/listings/${listing._id}`)
      .set('Authorization', stranger.auth);

    expect(res.status).toBe(403);
  });

  it('deletes the listing, its reviews, and its image files', async () => {
    const owner = await registerUser();
    const reviewer = await registerUser();

    const created = await request(app)
      .post('/api/listings')
      .set('Authorization', owner.auth)
      .field('title', 'Doomed Apartment')
      .field('address', '1 Test Street, Testville, OH')
      .field('school', 'Test University')
      .field('description', 'A description that is comfortably longer than twenty characters.')
      .field('rentPerMonth', '1200')
      .field('bedrooms', '2')
      .attach('images', pngBuffer(), 'one.png');

    const listing = created.body.listing;
    await createReview(reviewer.token, listing._id);

    const res = await request(app)
      .delete(`/api/listings/${listing._id}`)
      .set('Authorization', owner.auth);

    expect(res.status).toBe(200);
    expect(res.body.deletedReviews).toBe(1);

    expect((await request(app).get(`/api/listings/${listing._id}`)).status).toBe(404);
    expect(uploadedFileExists(listing.images[0])).toBe(false);

    const mine = await request(app).get('/api/reviews/mine').set('Authorization', reviewer.auth);
    expect(mine.body.reviews).toHaveLength(0);
  });
});

describe('unmatched routes', () => {
  it('returns a JSON 404', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(typeof res.body.message).toBe('string');
  });
});

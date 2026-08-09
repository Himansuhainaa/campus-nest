import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { app, request, registerUser, createListing, createReview, ratings } from './helpers.js';

/**
 * Reporting, moderation and the admin gate. The important property throughout:
 * a hidden review must vanish from public reads AND stop counting toward the
 * rating, or moderation is cosmetic.
 */

async function makeAdmin(email) {
  const User = mongoose.model('User');
  await User.updateOne({ email }, { $set: { role: 'admin' } });
}

async function setup() {
  const owner = await registerUser();
  const reviewer = await registerUser();
  const listing = await createListing(owner.token);
  const review = await createReview(reviewer.token, listing._id, {
    ratings: { noise: 5, landlordResponsiveness: 5, wifi: 5, safety: 5, value: 5 },
  });
  return { owner, reviewer, listing, review };
}

describe('POST /api/reviews/:id/report', () => {
  it('requires authentication', async () => {
    const { review } = await setup();
    const res = await request(app).post(`/api/reviews/${review._id}/report`).send({ reason: 'spam' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown reason', async () => {
    const { review } = await setup();
    const reporter = await registerUser();

    const res = await request(app)
      .post(`/api/reviews/${review._id}/report`)
      .set('Authorization', reporter.auth)
      .send({ reason: 'i-just-dont-like-it' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reason must be one of/i);
  });

  it('records a report and increments the count', async () => {
    const { review } = await setup();
    const reporter = await registerUser();

    const res = await request(app)
      .post(`/api/reviews/${review._id}/report`)
      .set('Authorization', reporter.auth)
      .send({ reason: 'spam', detail: 'Looks like an advert.' });

    expect(res.status).toBe(201);
    expect(res.body.reportCount).toBe(1);
  });

  it('is idempotent per user rather than inflating the count', async () => {
    const { review } = await setup();
    const reporter = await registerUser();

    const body = { reason: 'offensive' };
    await request(app).post(`/api/reviews/${review._id}/report`).set('Authorization', reporter.auth).send(body);
    const second = await request(app)
      .post(`/api/reviews/${review._id}/report`)
      .set('Authorization', reporter.auth)
      .send(body);

    expect(second.status).toBe(200);
    expect(second.body.message).toMatch(/already reported/i);

    const Review = mongoose.model('Review');
    const fresh = await Review.findById(review._id);
    expect(fresh.reportCount).toBe(1);
  });

  it('stops the author reporting their own review', async () => {
    const { reviewer, review } = await setup();

    const res = await request(app)
      .post(`/api/reviews/${review._id}/report`)
      .set('Authorization', reviewer.auth)
      .send({ reason: 'spam' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/your own review/i);
  });

  it('never exposes who reported a review on public reads', async () => {
    const { listing, review } = await setup();
    const reporter = await registerUser();
    await request(app)
      .post(`/api/reviews/${review._id}/report`)
      .set('Authorization', reporter.auth)
      .send({ reason: 'spam' });

    const res = await request(app).get(`/api/listings/${listing._id}`);
    expect(JSON.stringify(res.body)).not.toMatch(/"reports"/);
  });
});

describe('admin gate', () => {
  it('rejects an anonymous request', async () => {
    expect((await request(app).get('/api/admin/overview')).status).toBe(401);
  });

  it('rejects an ordinary signed-in user with 403', async () => {
    const user = await registerUser();
    const res = await request(app).get('/api/admin/overview').set('Authorization', user.auth);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/moderators only/i);
  });

  it('allows an admin', async () => {
    const user = await registerUser();
    await makeAdmin(user.user.email);

    const res = await request(app).get('/api/admin/overview').set('Authorization', user.auth);
    expect(res.status).toBe(200);
    expect(typeof res.body.counts.reviews).toBe('number');
  });

  it('does not let a client grant itself admin at registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Sneaky',
      email: `sneaky${Date.now()}@test.dev`,
      school: 'Test University',
      password: 'password123',
      role: 'admin', // ignored — role comes from ADMIN_EMAILS only
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
  });
});

describe('hiding a review', () => {
  let admin;
  let ctx;

  beforeEach(async () => {
    ctx = await setup();
    admin = await registerUser();
    await makeAdmin(admin.user.email);
  });

  it('removes it from the listing and from the rating average', async () => {
    const before = await request(app).get(`/api/listings/${ctx.listing._id}`);
    expect(before.body.listing.reviews).toHaveLength(1);
    expect(before.body.listing.ratingSummary.overall).toBe(5);

    const hide = await request(app)
      .patch(`/api/admin/reviews/${ctx.review._id}`)
      .set('Authorization', admin.auth)
      .send({ hidden: true, reason: 'Spam' });
    expect(hide.status).toBe(200);

    const after = await request(app).get(`/api/listings/${ctx.listing._id}`);
    expect(after.body.listing.reviews).toHaveLength(0);
    // The whole point: a hidden review must not keep propping up the score.
    expect(after.body.listing.ratingSummary.count).toBe(0);
    expect(after.body.listing.ratingSummary.overall).toBe(0);
  });

  it('also excludes it from the listings index aggregation', async () => {
    await request(app)
      .patch(`/api/admin/reviews/${ctx.review._id}`)
      .set('Authorization', admin.auth)
      .send({ hidden: true });

    const res = await request(app).get('/api/listings');
    const listing = res.body.listings.find((l) => l._id === ctx.listing._id);
    expect(listing.ratingSummary.count).toBe(0);
  });

  it('is reversible', async () => {
    await request(app)
      .patch(`/api/admin/reviews/${ctx.review._id}`)
      .set('Authorization', admin.auth)
      .send({ hidden: true });
    await request(app)
      .patch(`/api/admin/reviews/${ctx.review._id}`)
      .set('Authorization', admin.auth)
      .send({ hidden: false });

    const res = await request(app).get(`/api/listings/${ctx.listing._id}`);
    expect(res.body.listing.reviews).toHaveLength(1);
    expect(res.body.listing.ratingSummary.overall).toBe(5);
  });

  it('validates the hidden flag', async () => {
    const res = await request(app)
      .patch(`/api/admin/reviews/${ctx.review._id}`)
      .set('Authorization', admin.auth)
      .send({ hidden: 'yes please' });

    expect(res.status).toBe(400);
  });

  it('lists flagged reviews with their reasons but not reporter identities', async () => {
    const reporter = await registerUser();
    await request(app)
      .post(`/api/reviews/${ctx.review._id}/report`)
      .set('Authorization', reporter.auth)
      .send({ reason: 'personal-info', detail: 'Contains a phone number.' });

    const res = await request(app)
      .get('/api/admin/reviews?filter=flagged')
      .set('Authorization', admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.reviews[0].reports[0].reason).toBe('personal-info');
    expect(res.body.reviews[0].reports[0].user).toBeUndefined();
  });

  it('dismisses reports and keeps the review visible', async () => {
    const reporter = await registerUser();
    await request(app)
      .post(`/api/reviews/${ctx.review._id}/report`)
      .set('Authorization', reporter.auth)
      .send({ reason: 'spam' });

    const res = await request(app)
      .post(`/api/admin/reviews/${ctx.review._id}/dismiss-reports`)
      .set('Authorization', admin.auth);
    expect(res.status).toBe(200);

    const flagged = await request(app)
      .get('/api/admin/reviews?filter=flagged')
      .set('Authorization', admin.auth);
    expect(flagged.body.count).toBe(0);

    const listing = await request(app).get(`/api/listings/${ctx.listing._id}`);
    expect(listing.body.listing.reviews).toHaveLength(1);
  });
});

describe('email verification', () => {
  it('creates accounts already verified when email is not configured', async () => {
    // No SMTP_URL under test, so requiring verification would lock everyone out.
    const { user } = await registerUser();
    expect(user.emailVerified).toBe(true);
  });

  it('reports that verification is not required', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'No Mail',
      email: `nomail${Date.now()}@test.dev`,
      school: 'Test University',
      password: 'password123',
    });

    expect(res.body.verificationRequired).toBe(false);
  });

  it('rejects a bogus verification token', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({ token: 'not-a-real-token' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not valid/i);
  });

  it('requires a token', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({});
    expect(res.status).toBe(400);
  });

  it('never leaks the verification token through the API', async () => {
    const { user } = await registerUser();
    expect(user.verificationToken).toBeUndefined();
    expect(user.verificationExpires).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import {
  app,
  request,
  registerUser,
  createListing,
  createReview,
  ratings,
} from './helpers.js';

async function setup() {
  const owner = await registerUser();
  const reviewer = await registerUser();
  const listing = await createListing(owner.token);
  return { owner, reviewer, listing };
}

describe('POST /api/listings/:id/reviews', () => {
  it('requires authentication', async () => {
    const { listing } = await setup();
    const res = await request(app)
      .post(`/api/listings/${listing._id}/reviews`)
      .send({ ratings: ratings(), comment: 'A perfectly fine comment here.' });

    expect(res.status).toBe(401);
  });

  it('returns 404 for a listing that does not exist', async () => {
    const { reviewer } = await setup();
    const res = await request(app)
      .post('/api/listings/000000000000000000000000/reviews')
      .set('Authorization', reviewer.auth)
      .send({ ratings: ratings(), comment: 'A perfectly fine comment here.' });

    expect(res.status).toBe(404);
  });

  it('blocks the owner from reviewing their own listing', async () => {
    const { owner, listing } = await setup();
    const res = await request(app)
      .post(`/api/listings/${listing._id}/reviews`)
      .set('Authorization', owner.auth)
      .send({ ratings: ratings(), comment: 'Reviewing my own place here.' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/posted yourself/i);
  });

  it.each([
    ['a score above 5', { noise: 6 }, /between 1 and 5/],
    ['a score below 1', { noise: 0 }, /between 1 and 5/],
    ['a fractional score', { noise: 3.5 }, /whole number/],
  ])('rejects %s', async (_label, override, pattern) => {
    const { reviewer, listing } = await setup();
    const res = await request(app)
      .post(`/api/listings/${listing._id}/reviews`)
      .set('Authorization', reviewer.auth)
      .send({ ratings: ratings(override), comment: 'A perfectly fine comment here.' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(pattern);
  });

  it('rejects a missing rating category', async () => {
    const { reviewer, listing } = await setup();
    const incomplete = ratings();
    delete incomplete.value;

    const res = await request(app)
      .post(`/api/listings/${listing._id}/reviews`)
      .set('Authorization', reviewer.auth)
      .send({ ratings: incomplete, comment: 'A perfectly fine comment here.' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it('rejects an unknown rating category', async () => {
    const { reviewer, listing } = await setup();
    const res = await request(app)
      .post(`/api/listings/${listing._id}/reviews`)
      .set('Authorization', reviewer.auth)
      .send({
        ratings: { ...ratings(), vibes: 5 },
        comment: 'A perfectly fine comment here.',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/unknown rating category/i);
  });

  it('rejects a comment shorter than 10 characters', async () => {
    const { reviewer, listing } = await setup();
    const res = await request(app)
      .post(`/api/listings/${listing._id}/reviews`)
      .set('Authorization', reviewer.auth)
      .send({ ratings: ratings(), comment: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/10 characters/);
  });

  it('creates a review and computes overallRating as the mean of the five scores', async () => {
    const { reviewer, listing } = await setup();
    const res = await request(app)
      .post(`/api/listings/${listing._id}/reviews`)
      .set('Authorization', reviewer.auth)
      .send({
        ratings: { noise: 3, landlordResponsiveness: 5, wifi: 5, safety: 5, value: 4 },
        comment: 'Genuinely a decent place to live for the price.',
      });

    expect(res.status).toBe(201);
    expect(res.body.review.overallRating).toBe(4.4);
    expect(res.body.review.author.name).toBe('Test Student');
    expect(res.body.ratingSummary.count).toBe(1);
    expect(res.body.ratingSummary.overall).toBe(4.4);
  });

  it('ignores a client-supplied overallRating', async () => {
    const { reviewer, listing } = await setup();
    const res = await request(app)
      .post(`/api/listings/${listing._id}/reviews`)
      .set('Authorization', reviewer.auth)
      .send({
        ratings: { noise: 1, landlordResponsiveness: 1, wifi: 1, safety: 1, value: 1 },
        comment: 'Trying to inflate my own score here.',
        overallRating: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body.review.overallRating).toBe(1);
  });

  it('returns 409 on a second review of the same listing', async () => {
    const { reviewer, listing } = await setup();
    await createReview(reviewer.token, listing._id);

    const res = await request(app)
      .post(`/api/listings/${listing._id}/reviews`)
      .set('Authorization', reviewer.auth)
      .send({ ratings: ratings(), comment: 'Trying to review this twice now.' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already reviewed/i);
  });

  it('enforces one-per-user at the index level even under a race', async () => {
    const { reviewer, listing } = await setup();

    // Fire both before either can complete its pre-check — only the unique index
    // can save us here.
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        request(app)
          .post(`/api/listings/${listing._id}/reviews`)
          .set('Authorization', reviewer.auth)
          .send({ ratings: ratings(), comment: 'Racing to submit this review.' })
      )
    );

    const statuses = results.map((r) => r.value.status).sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('lets a different user review the same listing', async () => {
    const { reviewer, listing } = await setup();
    const second = await registerUser();

    await createReview(reviewer.token, listing._id);
    const res = await request(app)
      .post(`/api/listings/${listing._id}/reviews`)
      .set('Authorization', second.auth)
      .send({ ratings: ratings(), comment: 'A second opinion on this place.' });

    expect(res.status).toBe(201);
    expect(res.body.ratingSummary.count).toBe(2);
  });
});

describe('PUT /api/reviews/:id', () => {
  it('returns 403 for someone who is not the author', async () => {
    const { reviewer, listing } = await setup();
    const stranger = await registerUser();
    const review = await createReview(reviewer.token, listing._id);

    const res = await request(app)
      .put(`/api/reviews/${review._id}`)
      .set('Authorization', stranger.auth)
      .send({ comment: 'Editing someone elses review.' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/only the author/i);
  });

  it('accepts a partial rating update and recomputes overallRating', async () => {
    const { reviewer, listing } = await setup();
    const review = await createReview(reviewer.token, listing._id, {
      ratings: { noise: 3, landlordResponsiveness: 5, wifi: 5, safety: 5, value: 4 },
    });
    expect(review.overallRating).toBe(4.4);

    const res = await request(app)
      .put(`/api/reviews/${review._id}`)
      .set('Authorization', reviewer.auth)
      .send({ ratings: { noise: 5 } });

    expect(res.status).toBe(200);
    expect(res.body.review.overallRating).toBe(4.8);
    expect(res.body.review.ratings.landlordResponsiveness).toBe(5);
    expect(res.body.ratingSummary.overall).toBe(4.8);
  });

  it('rejects an empty update', async () => {
    const { reviewer, listing } = await setup();
    const review = await createReview(reviewer.token, listing._id);

    const res = await request(app)
      .put(`/api/reviews/${review._id}`)
      .set('Authorization', reviewer.auth)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/nothing to update/i);
  });

  it('returns 404 for a review that does not exist', async () => {
    const { reviewer } = await setup();
    const res = await request(app)
      .put('/api/reviews/000000000000000000000000')
      .set('Authorization', reviewer.auth)
      .send({ comment: 'Editing a ghost review here.' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/reviews/:id', () => {
  it('returns 403 for someone who is not the author', async () => {
    const { reviewer, listing } = await setup();
    const stranger = await registerUser();
    const review = await createReview(reviewer.token, listing._id);

    const res = await request(app)
      .delete(`/api/reviews/${review._id}`)
      .set('Authorization', stranger.auth);

    expect(res.status).toBe(403);
  });

  it('deletes the review and returns a fresh summary', async () => {
    const { reviewer, listing } = await setup();
    const review = await createReview(reviewer.token, listing._id);

    const res = await request(app)
      .delete(`/api/reviews/${review._id}`)
      .set('Authorization', reviewer.auth);

    expect(res.status).toBe(200);
    expect(res.body.ratingSummary.count).toBe(0);
    expect(res.body.ratingSummary.overall).toBe(0);

    const detail = await request(app).get(`/api/listings/${listing._id}`);
    expect(detail.body.listing.reviews).toHaveLength(0);
  });

  it('frees the slot so the same user can review again', async () => {
    const { reviewer, listing } = await setup();
    const review = await createReview(reviewer.token, listing._id);

    await request(app).delete(`/api/reviews/${review._id}`).set('Authorization', reviewer.auth);

    const res = await request(app)
      .post(`/api/listings/${listing._id}/reviews`)
      .set('Authorization', reviewer.auth)
      .send({ ratings: ratings(), comment: 'Changed my mind, here is take two.' });

    expect(res.status).toBe(201);
  });
});

describe('GET /api/reviews/mine', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/reviews/mine');
    expect(res.status).toBe(401);
  });

  it('is not shadowed by the /:id route', async () => {
    const { reviewer } = await setup();
    const res = await request(app).get('/api/reviews/mine').set('Authorization', reviewer.auth);

    // If "/mine" were parsed as an id this would be a 400 CastError.
    expect(res.status).toBe(200);
  });

  it('returns only the caller reviews, with listings populated', async () => {
    const { reviewer, listing } = await setup();
    const other = await registerUser();

    await createReview(reviewer.token, listing._id);
    await createReview(other.token, listing._id);

    const res = await request(app).get('/api/reviews/mine').set('Authorization', reviewer.auth);

    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0].listing.title).toBe('Test Apartment Near Campus');
  });
});

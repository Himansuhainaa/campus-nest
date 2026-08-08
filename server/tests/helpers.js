import path from 'node:path';
import fs from 'node:fs';
import request from 'supertest';
import app from '../src/index.js';

export { app, request };

let counter = 0;

export function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@test.dev`;
}

/** A real 1x1 PNG, so multer's MIME filter sees a genuine image. */
export function pngBuffer() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

export function uploadedFileExists(publicPath) {
  const dir = process.env.UPLOAD_DIR;
  return fs.existsSync(path.join(dir, path.basename(publicPath)));
}

export async function registerUser(overrides = {}) {
  const payload = {
    name: 'Test Student',
    email: uniqueEmail(),
    school: 'Test University',
    password: 'password123',
    ...overrides,
  };

  const res = await request(app).post('/api/auth/register').send(payload);
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    token: res.body.token,
    user: res.body.user,
    password: payload.password,
    auth: `Bearer ${res.body.token}`,
  };
}

export const listingPayload = (overrides = {}) => ({
  title: 'Test Apartment Near Campus',
  address: '1 Test Street, Testville, OH',
  school: 'Test University',
  description: 'A description that is comfortably longer than the twenty character minimum.',
  rentPerMonth: 1200,
  bedrooms: 2,
  ...overrides,
});

export async function createListing(token, overrides = {}) {
  const res = await request(app)
    .post('/api/listings')
    .set('Authorization', `Bearer ${token}`)
    .send(listingPayload(overrides));

  if (res.status !== 201) {
    throw new Error(`createListing failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.listing;
}

export const ratings = (overrides = {}) => ({
  noise: 4,
  landlordResponsiveness: 4,
  wifi: 4,
  safety: 4,
  value: 4,
  ...overrides,
});

export async function createReview(token, listingId, overrides = {}) {
  const body = {
    ratings: ratings(overrides.ratings),
    comment: overrides.comment || 'A perfectly reasonable review comment for testing.',
  };

  const res = await request(app)
    .post(`/api/listings/${listingId}/reviews`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);

  if (res.status !== 201) {
    throw new Error(`createReview failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.review;
}

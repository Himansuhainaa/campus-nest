import { describe, expect, it, vi } from 'vitest';
import { app, request, registerUser, listingPayload } from './helpers.js';
import { ApiError, errorHandler } from '../src/utils/errorHandler.js';

/**
 * Behaviour that only matters when something is going wrong: the storage
 * backend is over quota, the database is unreachable, or someone is hammering
 * the API. All of it is invisible in a healthy local run, which is exactly why
 * it needs tests.
 */

/** Minimal Express-style mocks so errorHandler can be exercised directly. */
function runErrorHandler(err) {
  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
  errorHandler(err, {}, res, () => {});
  return res;
}

describe('capacity and availability errors', () => {
  it('maps an unreachable database to 503, not 500', () => {
    const err = new Error('connection timed out');
    err.name = 'MongoServerSelectionError';

    const res = runErrorHandler(err);
    expect(res.statusCode).toBe(503);
    expect(res.payload.message).toMatch(/temporarily unreachable/i);
  });

  it('maps a network drop to 503', () => {
    const err = new Error('socket hang up');
    err.name = 'MongoNetworkError';

    expect(runErrorHandler(err).statusCode).toBe(503);
  });

  it('maps an Atlas storage-quota error to 503 with an explanatory message', () => {
    // What Atlas actually returns once an M0 cluster fills up.
    const err = new Error('you are over your space quota, using 512 MB of 512 MB');

    const res = runErrorHandler(err);
    expect(res.statusCode).toBe(503);
    expect(res.payload.message).toMatch(/storage limit/i);
  });

  it('still treats a genuine bug as 500', () => {
    const res = runErrorHandler(new TypeError('cannot read properties of undefined'));
    expect(res.statusCode).toBe(500);
  });

  it('leaves explicit ApiError statuses alone', () => {
    expect(runErrorHandler(ApiError.forbidden('nope')).statusCode).toBe(403);
    expect(runErrorHandler(ApiError.conflict('dupe')).statusCode).toBe(409);
  });
});

describe('upload degradation', () => {
  it('swallows a storage-backend failure and flags a warning', async () => {
    const { makeResilientUpload } = await import('../src/middleware/upload.js');

    // Cloudinary over quota / down / network failure — not the user's fault.
    const middleware = makeResilientUpload((_req, _res, next) =>
      next(new Error('Cloudinary: quota exceeded'))
    );

    const req = { files: [{ path: 'partial' }] };
    const next = vi.fn();
    middleware(req, {}, next);

    // Must continue to the controller, so the listing still gets created.
    expect(next).toHaveBeenCalledWith();
    expect(req.files).toEqual([]);
    expect(req.uploadWarning).toMatch(/photos could not be uploaded/i);
  });

  it.each([
    ['an ApiError from the file filter', ApiError.badRequest('Images must be JPG, PNG, WEBP or GIF.')],
    ['a MulterError', Object.assign(new Error('too many files'), { name: 'MulterError' })],
  ])('propagates %s instead of degrading', async (_label, thrown) => {
    const { makeResilientUpload } = await import('../src/middleware/upload.js');

    const middleware = makeResilientUpload((_req, _res, next) => next(thrown));
    const req = {};
    const next = vi.fn();
    middleware(req, {}, next);

    // User-fixable problems must surface, not be silently hidden.
    expect(next).toHaveBeenCalledWith(thrown);
    expect(req.uploadWarning).toBeUndefined();
  });

  it('passes through cleanly when the upload succeeds', async () => {
    const { makeResilientUpload } = await import('../src/middleware/upload.js');

    const middleware = makeResilientUpload((_req, _res, next) => next());
    const req = { files: [{ filename: 'a.png' }] };
    const next = vi.fn();
    middleware(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.files).toHaveLength(1);
    expect(req.uploadWarning).toBeUndefined();
  });

  it('still rejects a bad file type rather than silently dropping it', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Bad File Type Listing')
      .field('address', '1 Test Street, Testville, OH')
      .field('school', 'Test University')
      .field('description', 'A description comfortably longer than twenty characters.')
      .field('rentPerMonth', '1200')
      .field('bedrooms', '2')
      .attach('images', Buffer.from('not an image'), 'bad.txt');

    // A user mistake stays an error — degrading here would hide the problem.
    expect(res.status).toBe(400);
    expect(res.body.warning).toBeUndefined();
  });

  it('creates a listing with no images at all without a warning', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(listingPayload());

    expect(res.status).toBe(201);
    expect(res.body.warning).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('is disabled under test so the suite is not throttled', async () => {
    const { RATE_LIMIT_DISABLED } = await import('../src/middleware/rateLimit.js');
    expect(RATE_LIMIT_DISABLED).toBe(true);
  });

  it('builds real limiters when not disabled', async () => {
    // Guards against the limiters silently being no-ops in production.
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    vi.resetModules();

    const mod = await import('../src/middleware/rateLimit.js');
    expect(mod.RATE_LIMIT_DISABLED).toBe(false);
    // A real express-rate-limit middleware, not the passthrough.
    expect(typeof mod.authLimiter).toBe('function');
    expect(mod.authLimiter.length).toBeGreaterThanOrEqual(3);

    process.env.NODE_ENV = previous;
    vi.resetModules();
  });
});

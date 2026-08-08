import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * CORS is configured from CLIENT_ORIGIN at module load, so this file sets the
 * variable and imports a fresh copy of the app rather than reusing the shared
 * helper (which loads it with CLIENT_ORIGIN unset).
 */
const ALLOWED = 'https://campus-nest.vercel.app';

let app;
let request;
let previousOrigin;

beforeAll(async () => {
  previousOrigin = process.env.CLIENT_ORIGIN;
  process.env.CLIENT_ORIGIN = `${ALLOWED},http://localhost:5173`;

  // index.js builds the allowlist at import time, so drop any cached copy and
  // re-import it now that CLIENT_ORIGIN is set.
  vi.resetModules();
  const { default: supertest } = await import('supertest');
  const mod = await import('../src/index.js');
  request = supertest;
  app = mod.default;
});

afterAll(() => {
  process.env.CLIENT_ORIGIN = previousOrigin;
});

describe('CORS allowlist', () => {
  it('allows an origin on the list', async () => {
    const res = await request(app).get('/api/listings').set('Origin', ALLOWED);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('allows a second origin on the list', async () => {
    const res = await request(app).get('/api/listings').set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('tolerates a trailing slash on the incoming origin', async () => {
    const res = await request(app).get('/api/listings').set('Origin', `${ALLOWED}/`);
    expect(res.status).toBe(200);
  });

  it('rejects an unlisted origin with 403, not 500', async () => {
    const res = await request(app).get('/api/listings').set('Origin', 'https://evil.example.com');

    // A bare Error in the cors callback would land here as a 500 and be logged
    // as a server fault. A blocked origin is the client's problem, not ours.
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not allowed by CORS/i);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('still serves requests that carry no Origin header (curl, health checks)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});

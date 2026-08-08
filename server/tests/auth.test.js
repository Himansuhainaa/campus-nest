import { describe, expect, it } from 'vitest';
import { app, request, registerUser, uniqueEmail } from './helpers.js';

describe('GET /api/health', () => {
  it('reports ok and a connected database', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
  });

  it('reports which image backend is active', async () => {
    const res = await request(app).get('/api/health');
    // No CLOUDINARY_* vars under test, so it must report the disk fallback.
    expect(res.body.storage).toBe('disk');
  });

  it('never leaks credentials in the health payload', async () => {
    const res = await request(app).get('/api/health');
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/cloudinary:\/\//i);
    expect(serialized).not.toMatch(/mongodb(\+srv)?:\/\//i);
    expect(serialized).not.toMatch(/secret|password|api_key/i);
  });
});

describe('POST /api/auth/register', () => {
  it('rejects a request with missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Only A Name' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it('rejects a password shorter than 6 characters', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Short Pass',
      email: uniqueEmail(),
      school: 'Test University',
      password: '123',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/6 characters/);
  });

  it('rejects a malformed email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Bad Email',
      email: 'not-an-email',
      school: 'Test University',
      password: 'password123',
    });
    expect(res.status).toBe(400);
  });

  it('creates an account and returns a token', async () => {
    const email = uniqueEmail();
    const res = await request(app).post('/api/auth/register').send({
      name: 'New Student',
      email,
      school: 'Test University',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user._id).toBeTruthy();
  });

  it('never returns the password hash', async () => {
    const { user } = await registerUser();
    expect(user.passwordHash).toBeUndefined();
    expect(JSON.stringify(user)).not.toMatch(/passwordHash/);
  });

  it('returns 409 for a duplicate email', async () => {
    const { user } = await registerUser();
    const res = await request(app).post('/api/auth/register').send({
      name: 'Impostor',
      email: user.email,
      school: 'Test University',
      password: 'password123',
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('treats email as case-insensitive when detecting duplicates', async () => {
    const { user } = await registerUser({ email: uniqueEmail('Mixed').toLowerCase() });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Impostor',
      email: user.email.toUpperCase(),
      school: 'Test University',
      password: 'password123',
    });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('requires both email and password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.dev' });
    expect(res.status).toBe(400);
  });

  it('rejects a wrong password with 401', async () => {
    const { user } = await registerUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'definitely-wrong' });

    expect(res.status).toBe(401);
  });

  it('uses an identical message for unknown email and wrong password', async () => {
    const { user } = await registerUser();
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'definitely-wrong' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('ghost'), password: 'definitely-wrong' });

    // Otherwise the endpoint becomes an account-enumeration oracle.
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('returns a token for valid credentials', async () => {
    const { user, password } = await registerUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(user.email);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer garbage.token.here');

    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const { auth, user } = await registerUser();
    const res = await request(app).get('/api/auth/me').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.passwordHash).toBeUndefined();
  });
});

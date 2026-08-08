const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { ApiError, asyncHandler } = require('../utils/errorHandler');

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** POST /api/auth/register */
const register = asyncHandler(async (req, res) => {
  const name = str(req.body.name);
  const email = str(req.body.email).toLowerCase();
  const school = str(req.body.school);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const missing = [];
  if (!name) missing.push('name');
  if (!email) missing.push('email');
  if (!password) missing.push('password');
  if (!school) missing.push('school');
  if (missing.length) {
    throw ApiError.badRequest(`Missing required field(s): ${missing.join(', ')}.`);
  }
  if (password.length < 6) {
    throw ApiError.badRequest('Password must be at least 6 characters.');
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict('An account with that email already exists.');
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, school, passwordHash });

  res.status(201).json({ token: signToken(user), user: user.toJSON() });
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    throw ApiError.badRequest('Email and password are both required.');
  }

  // passwordHash is `select: false`, so ask for it explicitly.
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message either way so the endpoint can't be used to enumerate accounts.
  if (!user || !(await user.verifyPassword(password))) {
    throw ApiError.unauthorized('Incorrect email or password.');
  }

  res.json({ token: signToken(user), user: user.toJSON() });
});

/** GET /api/auth/me (protected) */
const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toJSON() });
});

module.exports = { register, login, me };

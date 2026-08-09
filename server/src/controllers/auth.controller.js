const crypto = require('crypto');
const User = require('../models/User');
const { signToken, isAdminEmail } = require('../middleware/auth');
const { sendMail, verificationEmail, EMAIL_ENABLED } = require('../utils/mailer');
const { ApiError, asyncHandler } = require('../utils/errorHandler');

const str = (v) => (typeof v === 'string' ? v.trim() : '');

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/** Where the confirmation link should point. */
function verificationUrl(token) {
  const base = (process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || '')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');
  return `${base || 'http://localhost:5173'}/verify-email?token=${token}`;
}

/** Admin status comes from ADMIN_EMAILS, never from anything a client can send. */
const roleFor = (email) => (isAdminEmail(email) ? 'admin' : 'user');

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
  const token = crypto.randomBytes(32).toString('hex');

  const user = await User.create({
    name,
    email,
    school,
    passwordHash,
    role: roleFor(email),
    // With no mail transport configured there is no way to deliver a link, so
    // requiring verification would lock everyone out. Verify on creation instead.
    emailVerified: !EMAIL_ENABLED,
    verificationToken: EMAIL_ENABLED ? token : undefined,
    verificationExpires: EMAIL_ENABLED ? new Date(Date.now() + VERIFICATION_TTL_MS) : undefined,
  });

  let emailSent = false;
  if (EMAIL_ENABLED) {
    const result = await sendMail({ to: email, ...verificationEmail({ name, url: verificationUrl(token) }) });
    emailSent = result.sent;
  }

  res.status(201).json({
    token: signToken(user),
    user: user.toJSON(),
    // The client uses this to decide whether to nudge the user to check inbox.
    verificationRequired: EMAIL_ENABLED,
    verificationEmailSent: emailSent,
  });
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

  // Promote/demote to match the current ADMIN_EMAILS list on every sign-in, so
  // changing the env var takes effect without touching the database.
  const role = roleFor(email);
  if (user.role !== role) {
    user.role = role;
    await user.save();
  }

  res.json({ token: signToken(user), user: user.toJSON() });
});

/** GET /api/auth/me (protected) */
const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toJSON() });
});

/** POST /api/auth/verify-email — body: { token } */
const verifyEmail = asyncHandler(async (req, res) => {
  const token = str(req.body.token);
  if (!token) throw ApiError.badRequest('Verification token is required.');

  const user = await User.findOne({ verificationToken: token }).select(
    '+verificationToken +verificationExpires'
  );
  if (!user) {
    throw ApiError.badRequest('That verification link is not valid. It may already have been used.');
  }
  if (user.verificationExpires && user.verificationExpires < new Date()) {
    throw ApiError.badRequest('That verification link has expired. Request a new one.');
  }

  user.emailVerified = true;
  user.verificationToken = undefined;
  user.verificationExpires = undefined;
  await user.save();

  res.json({ message: 'Email confirmed. You can post reviews now.', user: user.toJSON() });
});

/** POST /api/auth/resend-verification (protected) */
const resendVerification = asyncHandler(async (req, res) => {
  if (!EMAIL_ENABLED) {
    throw ApiError.badRequest('Email verification is not enabled on this deployment.');
  }
  if (req.user.emailVerified) {
    return res.json({ message: 'Your email is already confirmed.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  req.user.verificationToken = token;
  req.user.verificationExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
  await req.user.save();

  const result = await sendMail({
    to: req.user.email,
    ...verificationEmail({ name: req.user.name, url: verificationUrl(token) }),
  });

  if (!result.sent) {
    throw new ApiError(503, 'Could not send the email right now. Please try again shortly.');
  }
  res.json({ message: 'Confirmation email sent. Check your inbox.' });
});

module.exports = { register, login, me, verifyEmail, resendVerification };

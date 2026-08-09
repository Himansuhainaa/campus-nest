const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ApiError, asyncHandler } = require('../utils/errorHandler');

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '7d';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Copy server/.env.example to server/.env.');
  }
  return secret;
}

/** Sign a token for a user document. */
function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, getJwtSecret(), { expiresIn: TOKEN_TTL });
}

function readBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Hard auth gate: 401s unless a valid token maps to a live user.
 * Attaches the full (password-free) user document as `req.user`.
 */
const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = readBearerToken(req);
  if (!token) {
    throw ApiError.unauthorized('You must be signed in to do that.');
  }

  const payload = jwt.verify(token, getJwtSecret()); // throws -> handled centrally
  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('That account no longer exists.');
  }

  req.user = user;
  next();
});

/**
 * Soft auth: attaches `req.user` when a valid token is present, but never blocks.
 * Used on public reads so the API can tell the client "you already reviewed this".
 */
const attachUser = asyncHandler(async (req, _res, next) => {
  const token = readBearerToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.user = (await User.findById(payload.sub)) || undefined;
  } catch {
    // A bad/expired token on a public route is not an error — just stay anonymous.
  }
  next();
});

/**
 * Admin gate. Runs after requireAuth.
 *
 * Admins are granted by the ADMIN_EMAILS env var rather than a database flag
 * anyone could flip — see auth.controller. This just checks the resolved role.
 */
const requireAdmin = asyncHandler(async (req, _res, next) => {
  if (req.user?.role !== 'admin') {
    throw ApiError.forbidden('This area is for moderators only.');
  }
  next();
});

/** True when the email is listed in ADMIN_EMAILS (comma-separated). */
function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(String(email || '').toLowerCase());
}

/** 403 unless `req.user` owns the given document (checked against `field`). */
function requireOwnership(doc, req, field = 'createdBy', message) {
  const ownerId = doc[field]?._id ? doc[field]._id.toString() : String(doc[field]);
  if (ownerId !== req.user._id.toString()) {
    throw ApiError.forbidden(message || 'Only the owner can do that.');
  }
}

module.exports = {
  requireAuth,
  requireAdmin,
  attachUser,
  requireOwnership,
  signToken,
  isAdminEmail,
};

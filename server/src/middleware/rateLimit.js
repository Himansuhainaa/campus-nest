const rateLimit = require('express-rate-limit');

/* ---------------------------------------------------------------------------
 * Rate limiting exists here to protect the FREE TIERS this app runs on, not
 * just to stop malice. One script hammering the API can burn a month of Atlas
 * bandwidth, Cloudinary storage or Render instance-hours in an afternoon, and
 * every one of those failing takes the site down for everyone.
 *
 * Limits are deliberately generous for a human browsing the site and tight for
 * anything automated. Set DISABLE_RATE_LIMIT=true to turn them off (the test
 * suite does this, since it fires hundreds of requests from one address).
 * ------------------------------------------------------------------------- */

const DISABLED = process.env.DISABLE_RATE_LIMIT === 'true' || process.env.NODE_ENV === 'test';

const passthrough = (_req, _res, next) => next();

function build({ windowMs, limit, message }) {
  if (DISABLED) return passthrough;

  return rateLimit({
    windowMs,
    limit, // v7+ name for the old `max`
    standardHeaders: 'draft-7', // RateLimit-* headers so clients can back off
    legacyHeaders: false,
    // The shared error shape, so the client's getErrorMessage() reads it.
    handler: (_req, res) => res.status(429).json({ message }),
  });
}

/** Everything under /api. Wide enough that normal browsing never notices. */
const generalLimiter = build({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: 'Too many requests. Please wait a minute and try again.',
});

/**
 * Login and registration. Tight, because this is where credential-stuffing and
 * mass account creation would show up.
 */
const authLimiter = build({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
});

/**
 * Anything that writes. Uploads are the expensive path - each one costs
 * Cloudinary storage and bandwidth that does not come back.
 */
const writeLimiter = build({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  message:
    'You have posted a lot in a short time. Please wait a while before adding more.',
});

module.exports = { generalLimiter, authLimiter, writeLimiter, RATE_LIMIT_DISABLED: DISABLED };

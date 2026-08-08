/**
 * Shared error plumbing. Every controller throws ApiError (or lets a driver error
 * bubble) and the single errorHandler below turns it into `{ message: "..." }` JSON.
 */

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    if (details) this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'You must be signed in to do that.') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'You do not have permission to do that.') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Not found.') {
    return new ApiError(404, message);
  }
  static conflict(message) {
    return new ApiError(409, message);
  }
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** 404 fallback for unmatched routes. */
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist.`));
}

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Something went wrong on our end.';
  let details = err.details;

  // --- Mongoose / MongoDB driver errors -> friendly 4xx ------------------
  if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    details = Object.fromEntries(
      Object.entries(err.errors).map(([field, e]) => [field, e.message])
    );
    message = Object.values(details)[0] || 'Some fields are invalid.';
  } else if (err.name === 'CastError' && err.kind === 'ObjectId') {
    status = 400;
    message = 'That id is not valid.';
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {}).join(' + ');
    message =
      field === 'email'
        ? 'An account with that email already exists.'
        : field.includes('listing') && field.includes('author')
          ? 'You have already reviewed this listing.'
          : `Duplicate value for ${field || 'a unique field'}.`;
  }

  // --- Multer upload errors ---------------------------------------------
  else if (err.name === 'MulterError') {
    status = 400;
    const map = {
      LIMIT_FILE_SIZE: 'Each image must be 5 MB or smaller.',
      LIMIT_FILE_COUNT: 'You can upload at most 5 images.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field — use "images" and send at most 5 files.',
    };
    message = map[err.code] || `Upload failed: ${err.message}`;
  }

  // --- Capacity / availability ------------------------------------------
  // Free tiers run out: Atlas M0 caps storage at 512 MB, and a sleeping or
  // restarting database is unreachable rather than broken. Both are 503s the
  // visitor can act on, not 500s that read as "the site is broken".
  else if (
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoNotConnectedError'
  ) {
    status = 503;
    message = 'The database is temporarily unreachable. Please try again in a moment.';
  } else if (/over your space quota|quota exceeded|you are over/i.test(err.message || '')) {
    status = 503;
    message =
      'The site has reached its storage limit, so new posts are paused. Please try again later.';
  }

  // --- JWT errors --------------------------------------------------------
  else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Your session token is invalid. Please sign in again.';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Your session has expired. Please sign in again.';
  }

  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json(details ? { message, details } : { message });
}

module.exports = { ApiError, asyncHandler, notFoundHandler, errorHandler };

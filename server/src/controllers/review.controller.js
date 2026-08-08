const Review = require('../models/Review');
const Listing = require('../models/Listing');
const { requireOwnership } = require('../middleware/auth');
const { ApiError, asyncHandler } = require('../utils/errorHandler');

const { CATEGORY_KEYS, RATING_CATEGORIES } = Review;
const LABELS = Object.fromEntries(RATING_CATEGORIES.map((c) => [c.key, c.label]));

/**
 * Validate the five sub-scores. `partial` allows an edit to send only some of
 * them; the caller merges the result over the existing ratings.
 */
function readRatings(raw, { partial }) {
  if (raw === undefined || raw === null) {
    if (partial) return {};
    throw ApiError.badRequest('Ratings are required.');
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw ApiError.badRequest('Ratings must be an object of category scores.');
  }

  const out = {};
  for (const key of CATEGORY_KEYS) {
    const value = raw[key];
    if (value === undefined || value === null || value === '') {
      if (partial) continue;
      throw ApiError.badRequest(`${LABELS[key]} rating is required.`);
    }
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      throw ApiError.badRequest(
        `${LABELS[key]} rating must be a whole number between 1 and 5.`
      );
    }
    out[key] = n;
  }

  const unknown = Object.keys(raw).filter((k) => !CATEGORY_KEYS.includes(k));
  if (unknown.length) {
    throw ApiError.badRequest(`Unknown rating category: ${unknown.join(', ')}.`);
  }

  return out;
}

function readComment(raw, { partial }) {
  if (raw === undefined) {
    if (partial) return undefined;
    throw ApiError.badRequest('Please write a short comment.');
  }
  const comment = typeof raw === 'string' ? raw.trim() : '';
  if (comment.length < 10) {
    throw ApiError.badRequest('Comment must be at least 10 characters.');
  }
  if (comment.length > 2000) {
    throw ApiError.badRequest('Comment must be 2000 characters or fewer.');
  }
  return comment;
}

/** Recompute a listing's rollup after a write, so the client can update in place. */
async function summaryFor(listingId) {
  const reviews = await Review.find({ listing: listingId });
  return Review.summarize(reviews);
}

/** POST /api/listings/:id/reviews (protected; one review per user per listing). */
const createReview = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw ApiError.notFound('That listing does not exist (or was removed).');

  if (listing.createdBy.toString() === req.user._id.toString()) {
    throw ApiError.forbidden('You cannot review a listing you posted yourself.');
  }

  const existing = await Review.findOne({ listing: listing._id, author: req.user._id });
  if (existing) {
    throw ApiError.conflict('You have already reviewed this listing — edit your review instead.');
  }

  const ratings = readRatings(req.body.ratings, { partial: false });
  const comment = readComment(req.body.comment, { partial: false });

  // The unique index is the real guarantee; a duplicate here surfaces as 409
  // via the shared error handler (code 11000).
  const review = await Review.create({
    listing: listing._id,
    author: req.user._id,
    ratings,
    comment,
  });

  await review.populate('author', 'name school');

  res.status(201).json({
    review: review.toJSON(),
    ratingSummary: await summaryFor(listing._id),
  });
});

/** PUT /api/reviews/:id (protected, author-only). */
const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('That review does not exist (or was removed).');
  requireOwnership(review, req, 'author', 'Only the author can edit this review.');

  const ratings = readRatings(req.body.ratings, { partial: true });
  const comment = readComment(req.body.comment, { partial: true });

  if (!Object.keys(ratings).length && comment === undefined) {
    throw ApiError.badRequest('Nothing to update — send ratings and/or a comment.');
  }

  for (const [key, value] of Object.entries(ratings)) {
    review.ratings[key] = value;
  }
  if (comment !== undefined) review.comment = comment;

  review.markModified('ratings');
  await review.save(); // pre-validate recomputes overallRating
  await review.populate('author', 'name school');

  res.json({
    review: review.toJSON(),
    ratingSummary: await summaryFor(review.listing),
  });
});

/** DELETE /api/reviews/:id (protected, author-only). */
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('That review does not exist (or was already removed).');
  requireOwnership(review, req, 'author', 'Only the author can delete this review.');

  const listingId = review.listing;
  await review.deleteOne();

  res.json({
    message: 'Review deleted.',
    ratingSummary: await summaryFor(listingId),
  });
});

/** GET /api/reviews/mine (protected) — powers the Profile page. */
const myReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ author: req.user._id })
    .populate('listing', 'title school address images')
    .populate('author', 'name school')
    .sort({ createdAt: -1 });

  // A review whose listing was deleted has nothing to link to — skip it.
  res.json({ reviews: reviews.filter((r) => r.listing).map((r) => r.toJSON()) });
});

module.exports = { createReview, updateReview, deleteReview, myReviews };

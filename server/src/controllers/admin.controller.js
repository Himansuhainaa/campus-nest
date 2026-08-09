const Review = require('../models/Review');
const Listing = require('../models/Listing');
const User = require('../models/User');
const { removeStoredImage } = require('../middleware/upload');
const { ApiError, asyncHandler } = require('../utils/errorHandler');

/**
 * Moderation endpoints. Every route here sits behind requireAuth + requireAdmin,
 * and admin status comes from the ADMIN_EMAILS env var rather than a database
 * flag, so it cannot be granted by anything a client sends.
 */

/** GET /api/admin/overview — counts for the dashboard header. */
const overview = asyncHandler(async (_req, res) => {
  const [users, listings, reviews, hidden, flagged] = await Promise.all([
    User.countDocuments(),
    Listing.countDocuments(),
    Review.countDocuments(),
    Review.countDocuments({ hidden: true }),
    Review.countDocuments({ reportCount: { $gt: 0 }, hidden: { $ne: true } }),
  ]);

  res.json({ counts: { users, listings, reviews, hidden, flagged } });
});

/**
 * GET /api/admin/reviews?filter=flagged|hidden|all
 * Flagged first and by report count, so the worst offenders surface immediately.
 */
const listReviews = asyncHandler(async (req, res) => {
  const filter = req.query.filter || 'flagged';

  const match =
    filter === 'hidden'
      ? { hidden: true }
      : filter === 'all'
        ? {}
        : { reportCount: { $gt: 0 }, hidden: { $ne: true } };

  const reviews = await Review.find(match)
    .select('+reports')
    .populate('author', 'name email school')
    .populate('listing', 'title school')
    .sort({ reportCount: -1, createdAt: -1 })
    .limit(100);

  res.json({
    filter,
    count: reviews.length,
    reviews: reviews.map((r) => {
      const json = r.toJSON();
      // Reporter identities stay internal; the reasons are what moderation needs.
      json.reports = (r.reports || []).map((rep) => ({
        reason: rep.reason,
        detail: rep.detail,
        createdAt: rep.createdAt,
      }));
      return json;
    }),
  });
});

/** PATCH /api/admin/reviews/:id — body: { hidden: boolean, reason?: string } */
const setReviewHidden = asyncHandler(async (req, res) => {
  if (typeof req.body.hidden !== 'boolean') {
    throw ApiError.badRequest('`hidden` must be true or false.');
  }

  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('That review does not exist.');

  review.hidden = req.body.hidden;
  review.hiddenReason = req.body.hidden
    ? (typeof req.body.reason === 'string' ? req.body.reason.trim() : '') || 'Removed by a moderator'
    : undefined;
  await review.save();

  res.json({
    message: review.hidden ? 'Review hidden from the site.' : 'Review restored.',
    review: review.toJSON(),
  });
});

/** POST /api/admin/reviews/:id/dismiss-reports — keep the review, clear the flags. */
const dismissReports = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id).select('+reports');
  if (!review) throw ApiError.notFound('That review does not exist.');

  review.reports = [];
  review.reportCount = 0;
  review.hidden = false;
  review.hiddenReason = undefined;
  await review.save();

  res.json({ message: 'Reports dismissed — the review stays up.' });
});

/** DELETE /api/admin/reviews/:id — permanent, for content that must not persist. */
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('That review does not exist.');

  await review.deleteOne();
  res.json({ message: 'Review deleted permanently.' });
});

/** DELETE /api/admin/listings/:id — removes the listing, its reviews and its images. */
const deleteListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw ApiError.notFound('That listing does not exist.');

  const { deletedCount } = await Review.deleteMany({ listing: listing._id });
  await listing.deleteOne();
  await Promise.all(listing.images.map(removeStoredImage));

  res.json({ message: 'Listing deleted.', deletedReviews: deletedCount || 0 });
});

module.exports = {
  overview,
  listReviews,
  setReviewHidden,
  dismissReports,
  deleteReview,
  deleteListing,
};

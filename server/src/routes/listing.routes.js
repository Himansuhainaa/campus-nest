const express = require('express');
const {
  listListings,
  getListing,
  createListing,
  updateListing,
  deleteListing,
} = require('../controllers/listing.controller');
const { createReview } = require('../controllers/review.controller');
const { requireAuth } = require('../middleware/auth');
const { uploadListingImagesResilient } = require('../middleware/upload');
const { writeLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router
  .route('/')
  .get(listListings)
  .post(requireAuth, writeLimiter, uploadListingImagesResilient, createListing);

router
  .route('/:id')
  .get(getListing)
  .put(requireAuth, writeLimiter, uploadListingImagesResilient, updateListing)
  .delete(requireAuth, deleteListing);

// Nested: a review always belongs to a listing.
router.post('/:id/reviews', requireAuth, writeLimiter, createReview);

module.exports = router;

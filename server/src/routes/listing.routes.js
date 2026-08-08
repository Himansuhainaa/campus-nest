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
const { uploadListingImages } = require('../middleware/upload');

const router = express.Router();

router
  .route('/')
  .get(listListings)
  .post(requireAuth, uploadListingImages, createListing);

router
  .route('/:id')
  .get(getListing)
  .put(requireAuth, uploadListingImages, updateListing)
  .delete(requireAuth, deleteListing);

// Nested: a review always belongs to a listing.
router.post('/:id/reviews', requireAuth, createReview);

module.exports = router;

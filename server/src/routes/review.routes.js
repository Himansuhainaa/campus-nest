const express = require('express');
const {
  updateReview,
  deleteReview,
  myReviews,
  reportReview,
} = require('../controllers/review.controller');
const { requireAuth } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Must be declared before '/:id' so "mine" isn't parsed as an id.
router.get('/mine', requireAuth, myReviews);

router.post('/:id/report', requireAuth, writeLimiter, reportReview);

router.route('/:id').put(requireAuth, updateReview).delete(requireAuth, deleteReview);

module.exports = router;

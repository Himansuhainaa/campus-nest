const express = require('express');
const { updateReview, deleteReview, myReviews } = require('../controllers/review.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Must be declared before '/:id' so "mine" isn't parsed as an id.
router.get('/mine', requireAuth, myReviews);

router.route('/:id').put(requireAuth, updateReview).delete(requireAuth, deleteReview);

module.exports = router;

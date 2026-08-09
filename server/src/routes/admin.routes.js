const express = require('express');
const {
  overview,
  listReviews,
  setReviewHidden,
  dismissReports,
  deleteReview,
  deleteListing,
} = require('../controllers/admin.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Every route below is admin-only. Applied once here rather than per-route so a
// new endpoint cannot accidentally be added without the gate.
router.use(requireAuth, requireAdmin);

router.get('/overview', overview);
router.get('/reviews', listReviews);
router.patch('/reviews/:id', setReviewHidden);
router.post('/reviews/:id/dismiss-reports', dismissReports);
router.delete('/reviews/:id', deleteReview);
router.delete('/listings/:id', deleteListing);

module.exports = router;

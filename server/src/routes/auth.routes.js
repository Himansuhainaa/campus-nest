const express = require('express');
const {
  register,
  login,
  me,
  verifyEmail,
  resendVerification,
} = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Tight limits here: this is where credential stuffing and bulk account
// creation would show up.
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', requireAuth, me);

// Rate limited too: the token is guessable-in-principle, and resend is a
// free way to make us send mail on someone else's behalf.
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/resend-verification', requireAuth, authLimiter, resendVerification);

module.exports = router;

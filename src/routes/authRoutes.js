const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { register, login } = require('../controllers/authController');

const router = express.Router();
const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
});
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});
router.post('/register', registrationRateLimit, register);
router.post('/login', loginRateLimit, login);

module.exports = router;

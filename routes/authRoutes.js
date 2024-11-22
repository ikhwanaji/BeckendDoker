// const express = require('express');
// const router = express.Router();
// const { registerUser } = require('../controllers/registerController');

// router.post('/register', registerUser);

// module.exports = router;

// routes/authRoutes.js

const express = require('express');
const router = express.Router();
const passport = require('passport');
const { register, login, getProfile } = require('../controllers/authController');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get(
  '/profile',
  passport.authenticate('jwt', { session: false }),
  getProfile
);

module.exports = router;
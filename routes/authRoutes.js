const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { registerValidation, register, login, getProfile } = require('../controllers/authController');
// const passwordController = require('../controllers/passwordController');

// Public routes
router.post('/register', registerValidation,register);
router.post('/login', login);

// Route Google OAuth - Inisiasi Login
router.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// Callback Google OAuth
router.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
  }),
  (req, res) => {
    // Generate JWT token
    const payload = {
      id: req.user.userId,
      email: req.user.email,
      role: req.user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    // Redirect dengan token (sesuaikan dengan kebutuhan frontend)
    res.redirect(`http://127.0.0.1:3040/api/login/success?token=${token}`);
  }
);

// Protected routes
router.get('/profile', passport.authenticate('jwt', { session: false }), getProfile);

// Logout route
router.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Route untuk mendapatkan status autentikasi
router.get('/auth/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      isAuthenticated: true,
      user: {
        id: req.user.userId,
        nama: req.user.nama,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } else {
    res.json({ isAuthenticated: false });
  }
});

// Contoh route terproteksi
router.get('/protected', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json(req.user);
});


module.exports = router;

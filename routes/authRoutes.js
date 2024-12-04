const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { registerValidation, register, login, loginAdmin, getProfile, updateProfile, getUsers, updateUser, deleteUser, updateUserPassword, logoutAdmin } = require('../controllers/authController');
const { createLaporan, getLaporan, deleteLaporan } = require(`../controllers/kontakController`);
const { checkAdminRole } = require(`../middleware/authMiddleware`);
const { validateImageUpload, validateArticleImageUpload } = require('../middleware/uploadMiddleware');
const { createArtikel, getArtikel, getArtikelById, updateArtikel, deleteArtikel, searchArtikel, getLatestArtikel } = require('../controllers/artikelController');
const { getArtikelImage, getProfileImage, uploadProfileImage, deleteProfileImage } = require('../controllers/imageController');

// Public routes
router.post('/register', registerValidation, register);
router.post('/login', login);
router.post('/login-admin', loginAdmin);
router.get('/admin/users', passport.authenticate('jwt', { session: false }), checkAdminRole, getUsers);
router.post('/admin/logout', logoutAdmin);

// Route untuk get all users
router.get('/users', getUsers);
// Route untuk user by ID
router.get('/users/:userId', getUsers);
router.put('/users/:userId', validateImageUpload, updateUser);
router.put('/change-password',passport.authenticate('jwt', { session: false }), updateUserPassword);
router.delete('/users/:userId', deleteUser);
router.post('/profile-image', validateImageUpload);
router.get('/profile', passport.authenticate('jwt', { session: false }), getProfile);
router.put('/profile', passport.authenticate('jwt', { session: false }), updateProfile);
router.get('/profile-image/:filename', getProfileImage);
router.post('/profile/upload-image', passport.authenticate('jwt', { session: false }), validateImageUpload, uploadProfileImage);
router.delete('/profile/upload-image', passport.authenticate('jwt', { session: false }), validateImageUpload, deleteProfileImage);

//Router Untuk Kontak
router.post('/kontak', createLaporan);
router.get('/laporan', getLaporan);
router.delete('/laporan/:laporanId', deleteLaporan); // Route untuk menghapus laporan

// Rute untuk artikel
router.post('/artikel', validateArticleImageUpload, createArtikel);
router.get('/artikel', getArtikel);
router.get('/search', searchArtikel);
router.get('/latest', getLatestArtikel);
router.get('/artikel/:artikelId', getArtikelById);
router.put('/artikel/:artikelId', validateArticleImageUpload, updateArtikel);
router.delete('/artikel/:artikelId', deleteArtikel);
router.get('/artikel/images/:filename', getArtikelImage);

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

router.get('/protected', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json(req.user);
});

module.exports = router;

const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { registerValidation, register, login, loginAdmin, getProfile, updateProfile, getUsers, updateUser, deleteUser, updateUserPassword, logoutAdmin } = require('../controllers/authController');
const { createLaporan, getLaporan, deleteLaporan } = require(`../controllers/kontakController`);
const { checkAdminRole } = require(`../middleware/authMiddleware`);
const { validateImageUpload, validateArticleImageUpload } = require('../middleware/uploadMiddleware');
const { createArtikel, getArtikel, getArtikelById, updateArtikel, deleteArtikel, searchArtikel, getLatestArtikel } = require('../controllers/artikelController');
const { getArtikelImage, getProfileImage, uploadProfileImage, deleteProfileImage } = require('../controllers/imageController');
const { forgotPassword, verifyResetCode } = require('../controllers/authController');

// Public routes
router.post('/register', registerValidation, register);
router.post('/login', login);
router.post('/login-admin', loginAdmin);
router.get('/admin/users', passport.authenticate('jwt', { session: true }), checkAdminRole, getUsers);
router.post('/admin/logout', logoutAdmin);

// Route untuk get all users
router.get('/users', getUsers);
// Route untuk user by ID
router.get('/users/:userId', getUsers);
router.put('/users/:userId', validateImageUpload, updateUser);
router.put('/change-password', passport.authenticate('jwt', { session: false }), updateUserPassword);
router.delete('/users/:userId', deleteUser);
router.post('/profile-image', validateImageUpload);
router.get('/profile', passport.authenticate('jwt', { session: false }), getProfile);
router.put('/profile', passport.authenticate('jwt', { session: false }), updateProfile);
router.get('/profile-image/:filename', getProfileImage);
router.post('/profile/upload-image', passport.authenticate('jwt', { session: false }), validateImageUpload, uploadProfileImage);
router.delete('/profile/upload-image', passport.authenticate('jwt', { session: false }), validateImageUpload, deleteProfileImage);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-code', verifyResetCode);

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

// Konfigurasi Passport
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
      passReqToCallback: true,
    },
    async function (request, accessToken, refreshToken, profile, done) {
      const connection = await pool.getConnection();

      try {
        const { id: googleId, emails, displayName: nama, photos } = profile;
        const email = emails[0].value;
        const gambar = photos && photos.length > 0 ? photos[0].value : null;

        console.log('Google Login Attempt:', {
          googleId,
          email,
          nama,
          gambarUrl: gambar,
        });

        // Cari user berdasarkan email ATAU google_id
        const [existingUsers] = await connection.execute('SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR google_id = ?', [email, googleId]);

        let userId;

        if (existingUsers.length > 0) {
          const user = existingUsers[0];
          userId = user.userId;

          // Update informasi jika perlu
          const updateData = {
            google_id: googleId || user.google_id,
            nama: nama || user.nama,
            gambar: gambar || user.gambar,
            updated_at: new Date(),
          };

          const updateFields = Object.entries(updateData)
            .filter(([key, value]) => value !== null && value !== undefined)
            .map(([key]) => `${key} = ?`)
            .join(', ');

          const updateValues = Object.entries(updateData)
            .filter(([key, value]) => value !== null && value !== undefined)
            .map(([, value]) => value)
            .concat(userId);

          if (updateFields) {
            await connection.execute(`UPDATE users SET ${updateFields} WHERE userId = ?`, updateValues);
            console.log('Updated existing user:', userId);
          }
        } else {
          // Buat user baru jika tidak ditemukan
          const [result] = await connection.execute('INSERT INTO users (nama, email, gambar, role, google_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())', [nama, email, gambar, 'user', googleId]);

          userId = result.insertId;
          console.log('Created new user:', userId);
        }

        // Ambil data user terbaru
        const [userData] = await connection.execute('SELECT userId, nama, email, gambar, no_hp, alamat, role FROM users WHERE userId = ?', [userId]);

        return done(null, userData[0]);
      } catch (error) {
        console.error('Google authentication detailed error:', error);
        return done(error, null);
      } finally {
        connection.release();
      }
    }
  )
);

// Serialize user untuk session
passport.serializeUser((user, done) => {
  done(null, user.userId);
});

// Deserialize user dari session
passport.deserializeUser(async (userId, done) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [users] = await connection.execute('SELECT userId, nama, email, gambar, no_hp, alamat, role FROM users WHERE userId = ?', [userId]);

      if (users.length === 0) {
        return done(new Error('User tidak ditemukan'), null);
      }

      done(null, users[0]);
    } finally {
      connection.release();
    }
  } catch (error) {
    done(error, null);
  }
});

// Inisiasi login Google
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['email', 'profile'],
  })
);

// Callback setelah autentikasi Google
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
    session: true,
  }),
  (req, res) => {
    try {
      // Generate JWT token for the user
      const user = req.user;
      const jwtToken = jwt.sign(
        {
          userId: user.userId,
          email: user.email,
          nama: user.nama,
          role: user.role,
          picture: user.gambar,
        },
        process.env.JWT_SECRET || 'YOUR_JWT_SECRET_KEY',
        {
          algorithm: 'HS256',
        }
      );

      // Opsi: redirect ke halaman frontend dengan token
      // res.redirect(`${process.env.FRONTEND_URL}/auth-success?token=${jwtToken}`);

      // Atau mengembalikan respons JSON

      res.status(200).json({
        success: true,
        message: 'Google login successful',
        token: jwtToken,
        user,
      });
    } catch (error) {
      console.error('JWT generation error:', error);
      res.redirect('/login?error=server_error');
    }
  }
);

// API endpoint untuk mendapatkan info pengguna saat ini (dengan token)
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
    }

    // Ensure the algorithm is explicitly set to 'HS256'
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'YOUR_JWT_SECRET_KEY', { algorithms: ['HS256'] });

    const connection = await pool.getConnection();
    try {
      const [userData] = await connection.execute('SELECT userId, nama, email, gambar, no_hp, alamat, role FROM users WHERE userId = ?', [decoded.userId]);

      if (userData.length === 0) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
      }

      res.status(200).json({
        success: true,
        user: userData[0],
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Token tidak valid atau kadaluarsa',
    });
  }
});

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

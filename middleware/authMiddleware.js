const passport = require('../config/passport');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const authenticate = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: info.message || 'Unauthorized',
      });
    }

    req.user = user;
    next();
  })(req, res, next);
};

const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden',
      });
    }

    next();
  };
};

// Middleware autentikasi
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Token tidak tersedia' });
  }

  try {
    // Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ambil detail user dari database
    const [users] = await pool.query('SELECT userId, nama, email, no_hp FROM users WHERE userId = ?', [decoded.id]);

    if (users.length === 0) {
      return res.status(401).json({ message: 'User tidak ditemukan' });
    }

    // Tambahkan informasi user ke request
    req.user = users[0];
    next();
  } catch (error) {
    if (error.nama === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token telah kadaluarsa' });
    }
    return res.status(403).json({ message: 'Token tidak valid' });
  }
};

// Middleware otorisasi admin
const requireAdmin = (req, res, next) => {
  // Pastikan user sudah diautentikasi terlebih dahulu
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Autentikasi diperlukan',
    });
  }

  // Cek apakah user adalah admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Anda tidak memiliki izin. Hanya admin yang dapat mengakses.',
    });
  }
  next();
};

// Middleware otorisasi untuk update profile sendiri atau admin
const authorizeUserOrAdmin = (req, res, next) => {
  // Pastikan user sudah diautentikasi
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Autentikasi diperlukan',
    });
  }

  // Ambil userId dari parameter atau body
  const targetUserId = req.params.userId || req.body.userId;

  // Cek apakah user adalah admin atau sedang update profile sendiri
  if (req.user.role === 'admin' || req.user.userId.toString() === targetUserId) {
    next();
  } else {
    return res.status(403).json({
      status: 'error',
      message: 'Anda tidak memiliki izin untuk mengakses atau mengubah data ini',
    });
  }
};

const checkAdminRole = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Tidak terautentikasi' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Akses ditolak' });
  }
  next();
};

const requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      status: 'error',
      message: 'Token tidak ada. Otorisasi ditolak.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Pastikan yang logout adalah admin
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak. Anda bukan admin.',
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Token tidak valid',
    });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'user']
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Anda tidak memiliki izin untuk melakukan aksi ini',
      });
    }
    next();
  };
};

const authLogout = (req, res, next) => {
  // Ambil token dari header Authorization
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Token tidak ditemukan',
    });
  }

  // Verifikasi token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        status: 'error',
        message: 'Token tidak valid',
      });
    }
    // Simpan informasi user ke request untuk digunakan di route selanjutnya
    req.user = user;
    next();
  });
};

module.exports = {
  authenticate,
  authorize,
  authLogout,
  authenticateToken,
  requireAdmin,
  authorizeUserOrAdmin,
  checkAdminRole,
  requireAdminAuth,
  restrictTo,
};

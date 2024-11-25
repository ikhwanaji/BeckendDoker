const passport = require('../config/passport');
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) return next(err);
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: info.message || 'Unauthorized'
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
        message: 'Unauthorized'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden'
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

// Middleware autentikasi
const authenticateToken = async (req, res, next) => {
  // Ambil token dari header Authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Token tidak tersedia. Autentikasi diperlukan.'
    });
  }

  try {
    // Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Cari user di database untuk validasi tambahan
    const connection = await pool.getConnection();
    try {
      const [users] = await connection.query(
        'SELECT userId, nama, email, role FROM users WHERE userId = ?', 
        [decoded.userId]
      );

      if (users.length === 0) {
        return res.status(401).json({
          status: 'error',
          message: 'Pengguna tidak ditemukan'
        });
      }

      // Tambahkan informasi user ke request
      req.user = users[0];
      next();
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token telah kedaluwarsa'
      });
    }

    return res.status(403).json({
      status: 'error',
      message: 'Token tidak valid'
    });
  }
};

// Middleware otorisasi admin
const requireAdmin = (req, res, next) => {
  // Pastikan user sudah diautentikasi terlebih dahulu
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Autentikasi diperlukan'
    });
  }

  // Cek apakah user adalah admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Anda tidak memiliki izin. Hanya admin yang dapat mengakses.'
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
      message: 'Autentikasi diperlukan'
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
      message: 'Anda tidak memiliki izin untuk mengakses atau mengubah data ini'
    });
  }
};

module.exports = {
  authenticate,
  authorize,
  authLogout,
  authenticateToken,
  requireAdmin,
  authorizeUserOrAdmin
};
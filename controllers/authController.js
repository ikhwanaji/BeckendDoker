const { pool } = require('../config/db'); // Mengimpor pool dari db.js
const bcrypt = require('bcrypt');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
require('../config/passport'); // Pastikan file config passport sudah dibuat

// Constants
const DEFAULT_ROLE = 'user';
const JWT_SECRET = process.env.JWT_SECRET ; // Gunakan environment variable
const JWT_EXPIRES_IN = '24h';

// Register Controller
const register = [
  body('nama').notEmpty().withMessage('Nama wajib diisi'),
  body('email').isEmail().withMessage('Format email tidak valid'),
  body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
  body('no_hp').notEmpty().withMessage('Nomor HP wajib diisi'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi gagal',
        errors: errors.array(),
      });
    }

    try {
      const { nama, email, password, no_hp } = req.body;

      // Cek email sudah terdaftar
      const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

      if (existingUser.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Email sudah terdaftar',
        });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Insert user baru
      const insertQuery = `
              INSERT INTO users 
              (nama, email, password, no_hp, role, created_at, update_at) 
              VALUES (?, ?, ?, ?, ?, NOW(), NOW())
            `;

      const [result] = await pool.query(insertQuery, [nama, email, hashedPassword, no_hp, DEFAULT_ROLE]);

      res.status(201).json({
        status: 'success',
        message: 'Registrasi berhasil',
        userId: result.insertId,
      });
    } catch (error) {
      console.error('Error registrasi:', error);
      res.status(500).json({
        status: 'error',
        message: 'Gagal melakukan registrasi',
        details: error.message,
      });
    }
  },
];

// Login Controller
const login = [
  body('email').isEmail().withMessage('Format email tidak valid'),
  body('password').notEmpty().withMessage('Password wajib diisi'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi gagal',
        errors: errors.array(),
      });
    }

    try {
      const { email, password } = req.body;

      // Cek user exists
      const [results] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

      if (results.length === 0) {
        return res.status(401).json({
          status: 'error',
          message: 'Email atau password salah',
        });
      }

      const user = results[0];

      // Verifikasi password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          status: 'error',
          message: 'Email atau password salah',
        });
      }

      // Generate JWT token
      const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      res.json({
        status: 'success',
        message: 'Login berhasil',
        token: `Bearer ${token}`,
        user: {
          id: user.id,
          nama: user.nama,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Error login:', error);
      res.status(500).json({
        status: 'error',
        message: 'Gagal melakukan login',
        details: error.message,
      });
    }
  },
];

// Protected Route Example
const getProfile = async (req, res) => {
  try {
    res.json({
      status: 'success',
      user: req.user, // Passport akan menyediakan user data
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil profil',
      details: error.message,
    });
  }
};

// Ekspor controller
module.exports = {
  register,
  login,
  getProfile,
};

const { pool } = require('../config/db'); // Mengimpor pool dari db.js
const bcrypt = require('bcrypt');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { body, validationResult } = require('express-validator');

require('../config/passport'); // Pastikan file config passport sudah dibuat

// Constants
const DEFAULT_ROLE = 'user';
const JWT_SECRET = process.env.JWT_SECRET; // Gunakan environment variable
const JWT_EXPIRES_IN = '24h';
const SALT_ROUNDS = 10

// Register Controller
const registerValidation = [
  body('nama')
    .notEmpty().withMessage('Nama wajib diisi')
    .trim()
    .escape(),
  
  body('email')
    .isEmail().withMessage('Format email tidak valid')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 }).withMessage('Password minimal 6 karakter')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/)
    .withMessage('Password harus kombinasi huruf besar, kecil, dan angka'),
  
  body('no_hp')
    .notEmpty().withMessage('Nomor HP wajib diisi')
    .matches(/^[0-9]{10,13}$/).withMessage('Nomor HP tidak valid')
]

const register = [
  ...registerValidation,

  async (req, res) => {
    // Validasi Error
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi gagal',
        errors: errors.array()
      })
    }

    const connection = await pool.getConnection()

    try {
      const { nama, email, password, no_hp } = req.body

      // Mulai Transaction
      await connection.beginTransaction()

      // Cek Email Sudah Terdaftar
      const [existingUsers] = await connection.query(
        'SELECT * FROM users WHERE email = ?', 
        [email]
      )

      if (existingUsers.length > 0) {
        await connection.rollback()
        return res.status(400).json({
          status: 'error',
          message: 'Email sudah terdaftar'
        })
      }

      // Hash Password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

      // Query Insert
      const insertQuery = `
        INSERT INTO users 
        (nama, email, password, no_hp, role, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `

      const [result] = await connection.query(insertQuery, [
        nama, 
        email, 
        hashedPassword, 
        no_hp, 
        DEFAULT_ROLE
      ])

      // Commit Transaction
      await connection.commit()

      // Response User Tanpa Password
      const userResponse = {
        id: result.insertId,
        nama,
        email,
        no_hp,
        role: DEFAULT_ROLE
      }

      res.status(201).json({
        status: 'success',
        message: 'Registrasi berhasil',
        user: userResponse
      })

    } catch (error) {
      // Rollback Transaksi Jika Error
      await connection.rollback()

      console.error('Error registrasi:', error)
      res.status(500).json({
        status: 'error',
        message: 'Gagal melakukan registrasi',
        details: error.message
      })
    } finally {
      // Selalu release connection
      connection.release()
    }
  }
]

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
        id: user.userId,
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
  registerValidation,
  register,
  login,
  getProfile,
};

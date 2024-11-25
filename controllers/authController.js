const { pool } = require('../config/db'); // Mengimpor pool dari db.js
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { body, validationResult } = require('express-validator');

require('../config/passport'); // Pastikan file config passport sudah dibuat

// Constants
const DEFAULT_ROLE = 'user';
const JWT_SECRET = process.env.JWT_SECRET; // Gunakan environment variable
const JWT_EXPIRES_IN = '24h';
const SALT_ROUNDS = 10;

// Register Controller
const registerValidation = [
  body('nama').notEmpty().withMessage('Nama wajib diisi').trim().escape(),

  body('email').isEmail().withMessage('Format email tidak valid').normalizeEmail(),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Password minimal 6 karakter')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/)
    .withMessage('Password harus kombinasi huruf besar, kecil, dan angka'),

  body('no_hp')
    .notEmpty()
    .withMessage('Nomor HP wajib diisi')
    .matches(/^[0-9]{10,13}$/)
    .withMessage('Nomor HP tidak valid'),
];

const register = [
  ...registerValidation,

  async (req, res) => {
    // Validasi Error
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi gagal',
        errors: errors.array(),
      });
    }

    const connection = await pool.getConnection();

    try {
      const { nama, email, password, no_hp } = req.body;

      // Mulai Transaction
      await connection.beginTransaction();

      // Cek Email Sudah Terdaftar
      const [existingUsers] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);

      if (existingUsers.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Email sudah terdaftar',
        });
      }

      // Hash Password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // Query Insert
      const insertQuery = `
        INSERT INTO users 
        (nama, email, password, no_hp, role, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `;

      const [result] = await connection.query(insertQuery, [nama, email, hashedPassword, no_hp, DEFAULT_ROLE]);

      // Commit Transaction
      await connection.commit();

      // Response User Tanpa Password
      const userResponse = {
        id: result.insertId,
        nama,
        email,
        no_hp,
        role: DEFAULT_ROLE,
      };

      res.status(201).json({
        status: 'success',
        message: 'Registrasi berhasil',
        user: userResponse,
      });
    } catch (error) {
      // Rollback Transaksi Jika Error
      await connection.rollback();

      console.error('Error registrasi:', error);
      res.status(500).json({
        status: 'error',
        message: 'Gagal melakukan registrasi',
        details: error.message,
      });
    } finally {
      // Selalu release connection
      connection.release();
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

// Get All Users Controller
const getUsers = async (req, res) => {
  const { userId } = req.params;
  const connection = await pool.getConnection();

  try {
    let query = 'SELECT userId, nama, email, password, no_hp, role FROM users';
    let queryParams = [];

    // Jika ada userId, filter berdasarkan userId
    if (userId) {
      query += ' WHERE userId = ?';
      queryParams.push(userId);
    }

    const [users] = await connection.query(query, queryParams);

    // Jika mencari spesifik user berdasarkan ID
    if (userId) {
      // Cek apakah user ditemukan
      if (users.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Pengguna tidak ditemukan',
        });
      }

      // Kembalikan single user jika mencari by ID
      return res.status(200).json({
        status: 'success',
        data: users[0],
      });
    }

    // Kembalikan semua users jika tidak ada filter
    res.status(200).json({
      status: 'success',
      data: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data pengguna',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

// Update User Controller
const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { nama, email, no_hp, role, password } = req.body;
  const connection = await pool.getConnection();

  try {
    // Validasi input
    if (!nama || !email || !no_hp) {
      return res.status(400).json({
        status: 'error',
        message: 'Nama, email, dan nomor HP harus diisi',
      });
    }

    // Cek apakah user dengan ID tersebut ada
    const [existingUser] = await connection.query('SELECT * FROM users WHERE userId = ?', [userId]);

    if (existingUser.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengguna tidak ditemukan',
      });
    }

    // Validasi role
    const validRoles = ['user', 'admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        status: 'error',
        message: 'Role tidak valid. Hanya boleh "user" atau "admin"',
      });
    }

    // Siapkan data untuk update
    let updateData = {
      nama,
      email,
      no_hp,
      role: role || existingUser[0].role,
    };

    // Proses upload gambar jika ada
    let gambarPath = existingUser[0].gambar;
    if (req.file) {
      // Hapus gambar lama jika ada
      if (existingUser[0].gambar && fs.existsSync(path.join('uploads', existingUser[0].gambar))) {
        fs.unlinkSync(path.join('uploads', existingUser[0].gambar));
      }

      // Simpan path gambar baru
      gambarPath = req.file.filename;
      updateData.gambar = gambarPath;
    }

    // Proses update password jika diisi
    if (password) {
      // Hash password baru
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updateData.password = hashedPassword;
    }

    // Siapkan query dinamis
    const updateFields = Object.keys(updateData)
      .map((key) => `${key} = ?`)
      .join(', ');

    const updateValues = [...Object.values(updateData), userId];

    // Jalankan query update
    const [result] = await connection.query(`UPDATE users SET ${updateFields} WHERE userId = ?`, updateValues);

    // Cek apakah update berhasil
    if (result.affectedRows === 0) {
      return res.status(500).json({
        status: 'error',
        message: 'Gagal memperbarui pengguna',
      });
    }

    // Ambil data user yang baru diupdate
    const [updatedUser] = await connection.query('SELECT userId, nama, email, no_hp, role, gambar FROM users WHERE userId = ?', [userId]);

    res.status(200).json({
      status: 'success',
      message: 'Berhasil memperbarui pengguna',
      data: updatedUser[0],
    });
  } catch (error) {
    console.error('Error updating user:', error);

    // Tangani error email unique jika ada
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        status: 'error',
        message: 'Email sudah terdaftar',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui pengguna',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

// Optional: Tambahkan update password dengan hash
const updateUserPassword = async (req, res) => {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;
  const connection = await pool.getConnection();

  try {
    // Validasi input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Password lama dan baru harus diisi',
      });
    }

    // Cek user
    const [users] = await connection.query('SELECT * FROM users WHERE userId = ?', [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengguna tidak ditemukan',
      });
    }

    const user = users[0];

    // Verifikasi password lama
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Password lama tidak sesuai',
      });
    }

    // Hash password baru
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await connection.query('UPDATE users SET password = ? WHERE userId = ?', [hashedNewPassword, userId]);

    res.status(200).json({
      status: 'success',
      message: 'Berhasil memperbarui password',
    });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui password',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

const logout = async (req, res) => {
  try {
    // Dapatkan user dari middleware
    const userId = req.user.id;

    // Opsional: Lakukan proses logout tambahan
    // Misalnya update status login atau catat log

    res.json({
      status: 'success',
      message: 'Logout berhasil',
      userId: userId,
    });
  } catch (error) {
    console.error('Error logout:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal logout',
    });
  }
};

// Ekspor controller
module.exports = {
  registerValidation,
  register,
  login,
  getProfile,
  getUsers,
  updateUser,
  updateUserPassword,
  logout,
};

const { pool } = require('../config/db'); // Mengimpor pool dari db.js
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
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
          message: 'Akses ditolak. Anda bukan User.',
        });
      }
      const users = results[0];

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

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' });

      res.json({
        status: 'success',
        message: 'Login berhasil',
        token: `Bearer ${token}`,
        user: {
          id: user.userId,
          nama: user.nama,
          email: user.email,
          no_hp: user.no_hp,
          alamat: user.alamat,
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

const loginAdmin = [
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

      // Cek user exists dengan role admin
      const [results] = await pool.query('SELECT * FROM users WHERE email = ? AND role = "admin"', [email]);

      if (results.length === 0) {
        return res.status(401).json({
          status: 'error',
          message: 'Akses ditolak. Anda bukan admin.',
        });
      }

      const admin = results[0];

      // Verifikasi password
      const isValidPassword = await bcrypt.compare(password, admin.password);
      if (!isValidPassword) {
        return res.status(401).json({
          status: 'error',
          message: 'Email atau password salah',
        });
      }

      // Generate JWT token
      const payload = {
        id: admin.userId,
        email: admin.email,
        role: admin.role,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' });

      res.json({
        status: 'success',
        message: 'Login admin berhasil',
        token: `Bearer ${token}`,
        user: {
          id: admin.userId,
          nama: admin.nama,
          email: admin.email,
          role: admin.role,
        },
      });
    } catch (error) {
      console.error('Error login admin:', error);
      res.status(500).json({
        status: 'error',
        message: 'Gagal melakukan login admin',
        details: error.message,
      });
    }
  },
];

// Protected Route
const getProfile = async (req, res) => {
  try {
    // req.user sudah tersedia dari passport JWT
    const userId = req.user.userId;

    // Query database untuk mendapatkan detail user
    const [results] = await pool.query('SELECT userId, nama, email,gambar,no_hp,alamat, role FROM users WHERE userId = ?', [userId]);

    if (results.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Profil tidak ditemukan',
      });
    }

    const user = results[0];

    res.json({
      status: 'success',
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        gambar: user.gambar ? `${user.gambar}` : null,
        no_hp: user.no_hp,
        alamat: user.alamat,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error mengambil profil:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil profil',
      details: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  const userId = req.user.userId;
  const { nama, email, no_hp, alamat } = req.body;

  try {
    // Validasi input
    if (!nama || !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Nama dan email wajib diisi',
      });
    }

    // Update profil
    await pool.query('UPDATE users SET nama = ?, email = ?, no_hp = ?, alamat = ? WHERE userId = ?', [nama, email, no_hp, alamat, userId]);

    // Ambil data profil terbaru
    const [updatedResults] = await pool.query('SELECT userId, nama, email, gambar, no_hp, alamat, role FROM users WHERE userId = ?', [userId]);

    const updatedUser = updatedResults[0];

    res.json({
      status: 'success',
      message: 'Profil berhasil diperbarui',
      user: {
        id: updatedUser.userId,
        nama: updatedUser.nama,
        email: updatedUser.email,
        gambar: updatedUser.gambar ? `/api/users/profile-image/${updatedUser.gambar}` : null,
        no_hp: updatedUser.no_hp,
        alamat: updatedUser.alamat,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error('Error memperbarui profil:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui profil',
      details: error.message,
    });
  }
};

// Get All Users Controller
const getUsers = async (req, res) => {
  const { userId } = req.params;
  const connection = await pool.getConnection();

  try {
    let query = 'SELECT userId, nama, email, password, gambar, no_hp, role FROM users';
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
  const { nama, email, no_hp, alamat, role, password } = req.body;
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
      alamat,
      role: role || existingUser[0].role,
    };

    // Proses upload gambar jika ada
    let gambarPath = existingUser[0].gambar;
    if (req.file) {
      // Hapus gambar lama jika ada
      if (existingUser[0].gambar && fs.existsSync(path.join('uploads/users', existingUser[0].gambar))) {
        fs.unlinkSync(path.join('uploads/users', existingUser[0].gambar));
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
    const [updatedUser] = await connection.query('SELECT userId, nama, email, no_hp, alamat,role, gambar FROM users WHERE userId = ?', [userId]);

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

const deleteUser = async (req, res) => {
  const { userId } = req.params;
  const connection = await pool.getConnection();

  try {
    // Cek apakah userId diberikan
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'userId harus diberikan',
      });
    }

    // Cek terlebih dahulu apakah user dengan userId tersebut ada
    const [existingUser] = await connection.query('SELECT * FROM users WHERE userId = ?', [userId]);

    // Jika user tidak ditemukan
    if (existingUser.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Pengguna tidak ditemukan',
      });
    }

    // Lakukan proses penghapusan user
    const [result] = await connection.query('DELETE FROM users WHERE userId = ?', [userId]);

    // Cek apakah penghapusan berhasil
    if (result.affectedRows === 0) {
      return res.status(500).json({
        status: 'error',
        message: 'Gagal menghapus pengguna',
      });
    }

    // Kirim respons berhasil
    res.status(200).json({
      status: 'success',
      message: 'Pengguna berhasil dihapus',
      data: {
        userId: userId,
      },
    });
  } catch (error) {
    console.error('Error menghapus pengguna:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus pengguna',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

// Optional: Tambahkan update password dengan hash
const updateUserPassword = async (req, res) => {
  // Gunakan req.user.id dari middleware autentikasi
  const userId = req.user.userId;
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // Tambahkan validasi tambahan
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      status: 'error',
      message: 'Semua field harus diisi',
    });
  }

  // Validasi konfirmasi password
  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      status: 'error',
      message: 'Konfirmasi password tidak sesuai',
    });
  }

  // Validasi kompleksitas password
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({
      status: 'error',
      message: 'Password harus minimal 8 karakter, mengandung huruf besar, huruf kecil, angka, dan karakter spesial',
    });
  }

  let connection;
  try {
    // Dapatkan koneksi dari pool
    connection = await pool.getConnection();

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

    // Cegah penggunaan password lama
    const isSameAsOldPassword = await bcrypt.compare(newPassword, user.password);
    if (isSameAsOldPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Password baru tidak boleh sama dengan password lama',
      });
    }

    // Hash password baru
    const hashedNewPassword = await bcrypt.hash(newPassword, 10); // Naikkan cost factor

    // Update password
    const [result] = await connection.query('UPDATE users SET password = ?, updated_At = NOW() WHERE userId = ?', [hashedNewPassword, userId]);

    // Cek apakah update berhasil
    if (result.affectedRows === 0) {
      return res.status(500).json({
        status: 'error',
        message: 'Gagal memperbarui password',
      });
    }

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
    // Pastikan koneksi selalu dilepas
    if (connection) connection.release();
  }
};

const logoutAdmin = (req, res) => {
  try {
    res.json({
      status: 'success',
      message: 'Logout admin berhasil',
    });
  } catch (error) {
    console.error('Error logout admin:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal melakukan logout admin',
      details: error.message,
    });
  }
};

// Konfigurasi email transporter (gunakan Gmail atau service lainnya)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER, // email Anda
    pass: process.env.SMTP_PASS, // app password Gmail atau password email
  },
  tls: {
    rejectUnauthorized: false,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('Email transporter error:', error);
  } else {
    console.log('Email transporter ready');
  }
});

// Fungsi untuk generate kode 4 digit
const generateResetCode = () => {
  return Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
};

// Controller untuk forgot password
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Validasi email
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Email tidak valid',
      });
    }

    // Cek apakah email terdaftar
    const [users] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Email tidak terdaftar',
      });
    }

    const user = users[0];

    // Generate kode reset 4 digit
    const resetCode = generateResetCode();
    const resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // Berlaku 15 menit

    // Simpan kode reset ke database (Anda perlu menambah kolom reset_code dan reset_code_expiry di tabel users)
    await connection.query('UPDATE users SET reset_code = ?, reset_code_expiry = ? WHERE email = ?', [resetCode, resetCodeExpiry, email]);

    // Kirim email dengan kode reset
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Kode Reset Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Reset Password</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p>Halo <strong>${user.nama}</strong>,</p>
            <p>Anda telah meminta untuk mereset password akun Anda. Gunakan kode berikut untuk melanjutkan proses reset:</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 8px; background-color: #e9f4ff; padding: 15px 25px; border-radius: 8px; display: inline-block;">
                ${resetCode}
              </span>
            </div>
            <p><strong>Kode ini berlaku selama 15 menit.</strong></p>
            <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
          </div>
          <p style="color: #666; font-size: 12px; text-align: center;">
            Email ini dikirim secara otomatis, mohon tidak membalas email ini.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    await connection.commit();

    res.status(200).json({
      status: 'success',
      message: 'Kode reset password telah dikirim ke email Anda',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error forgot password:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengirim kode reset password',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

// Controller untuk verifikasi kode dan reset password
const verifyResetCode = async (req, res) => {
  const { email, resetCode, newPassword } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Validasi input
    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Email, kode reset, dan password baru harus diisi',
      });
    }

    // Validasi password
    if (newPassword.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password minimal 6 karakter',
      });
    }

    // Cek kode reset
    const [users] = await connection.query('SELECT * FROM users WHERE email = ? AND reset_code = ? AND reset_code_expiry > NOW()', [email, resetCode]);

    if (users.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Kode reset tidak valid atau sudah kedaluwarsa',
      });
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password dan hapus kode reset
    await connection.query('UPDATE users SET password = ?, reset_code = NULL, reset_code_expiry = NULL WHERE email = ?', [hashedPassword, email]);

    await connection.commit();

    res.status(200).json({
      status: 'success',
      message: 'Password berhasil direset',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error verify reset code:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal mereset password',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

// Ekspor controller
module.exports = {
  registerValidation,
  register,
  login,
  loginAdmin,
  getProfile,
  updateProfile,
  getUsers,
  updateUser,
  deleteUser,
  updateUserPassword,
  logoutAdmin,
  forgotPassword,
  verifyResetCode,
};

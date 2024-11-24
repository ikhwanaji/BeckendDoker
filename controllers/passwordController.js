// const { pool } = require('../config/db');
// const bcrypt = require('bcrypt');
// const crypto = require('crypto');
// const nodemailer = require('nodemailer');
// const { body, validationResult } = require('express-validator');

// // Konfigurasi Nodemailer
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: process.env.SMTP_PORT,
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },    
// });

// // Generate Token Reset Password
// const generateResetToken = () => {
//   return crypto.randomBytes(32).toString('hex');
// };

// // Controller Permintaan Lupa Password
// const requestResetPassword = [
//   body('email').isEmail().withMessage('Format email tidak valid'),

//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Validasi gagal',
//         errors: errors.array(),
//       });
//     }

//     try {
//       const { email } = req.body;

//       // Cek apakah email terdaftar
//       const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

//       if (users.length === 0) {
//         return res.status(404).json({
//           status: 'error',
//           message: 'Email tidak ditemukan',
//         });
//       }

//       const user = users[0];

//       // Generate reset token
//       const resetToken = generateResetToken();
//       const createdAt = new Date();
//       const expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000); // Token berlaku 1 jam

//       // Simpan token di tabel lupapassword
//       const [insertResult] = await pool.query(
//         'INSERT INTO lupapassword (userId, reset_token, created_at, expires_at) VALUES (?, ?, ?, ?)',
//         [user.userId, resetToken, createdAt, expiresAt] // Ganti user.id dengan user.userId
//       );

//       // Kirim email reset password
//       const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

//       const mailOptions = {
//         from: process.env.EMAIL_FROM,
//         to: email,
//         subject: 'Permintaan Reset Password',
//         html: `
//           <h2>Reset Password</h2>
//           <p>Anda menerima email ini karena meminta reset password.</p>
//           <p>Silakan klik link berikut untuk mereset password:</p>
//           <a href="${resetLink}">${resetLink}</a>
//           <p>Link ini akan kedaluwarsa dalam 1 jam.</p>
//           <p>Abaikan email ini jika Anda tidak meminta reset password.</p>
//           <p>Jika Anda tidak merasa meminta reset, abaikan email ini.</p>
//         `,
//       };

//       await transporter.sendMail(mailOptions);

//       res.status(200).json({
//         status: 'success',
//         message: 'Email reset password telah dikirim',
//         resetTokenId: insertResult.insertId,
//       });
//     } catch (error) {
//       console.error('Error request reset password:', error);
//       res.status(500).json({
//         status: 'error',
//         message: 'Gagal memproses permintaan reset password',
//         details: error.message,
//       });
//     }
//   },
// ];

// // Controller Reset Password
// const resetPassword = [
//   body('token').notEmpty().withMessage('Token reset wajib diisi'),
//   body('newPassword')
//     .isLength({ min: 8 })
//     .withMessage('Password minimal 8 karakter')
//     .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
//     .withMessage('Password harus mengandung huruf besar, huruf kecil, angka, dan karakter spesial'),

//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Validasi gagal',
//         errors: errors.array(),
//       });
//     }

//     try {
//       const { token, newPassword } = req.body;

//       // Cari permintaan reset password yang valid
//       const [resetRequests] = await pool.query(
//         `SELECT lp.*, u.email 
//         FROM lupapassword lp
//         JOIN users u ON lp.userId = u.userId
//         WHERE lp.reset_token = ? 
//         AND lp.expires_at > NOW() 
//         AND lp.is_used = FALSE`,
//         [token]
//       );

//       if (resetRequests.length === 0) {
//         return res.status(400).json({
//           status: 'error',
//           message: 'Token reset tidak valid atau sudah kedaluwarsa',
//         });
//       }

//       const resetRequest = resetRequests[0];

//       // Hash password baru
//       const saltRounds = 12;
//       const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

//       // Mulai transaksi
//       const connection = await pool.getConnection();

//       try {
//         await connection.beginTransaction();

//         // Update password pengguna
//         await connection.query(
//           'UPDATE users SET password = ? WHERE userId = ?',
//           [hashedPassword, resetRequest.userId] // Ganti id dengan userId
//         );

//         // Tandai token sebagai sudah digunakan
//         await connection.query(
//           'UPDATE lupapassword SET is_used = TRUE WHERE lupapasswordId = ?',
//           [resetRequest.lupapasswordId] // Ganti id dengan lupapasswordId
//         );

//         await connection.commit();

//         // Kirim email konfirmasi
//         await transporter.sendMail({
//           from: process.env.EMAIL_FROM,
//           to: resetRequest.email,
//           subject: 'Password Berhasil Direset',
//           html: `
//            <h2>Password Telah Direset</h2>
//            <p>Password akun Anda telah berhasil direset.</p>
//            <p>Jika Anda tidak melakukan ini, segera hubungi tim dukungan kami.</p>
//          `,
//         });

//         res.status(200).json({
//           status: 'success',
//           message: 'Password berhasil direset',
//         });
//       } catch (transactionError) {
//         await connection.rollback();
//         throw transactionError;
//       } finally {
//         connection.release();
//       }
//     } catch (error) {
//       console.error('Error reset password:', error);
//       res.status(500).json({
//         status: 'error',
//         message: 'Gagal mereset password',
//         details: error.message,
//       });
//     }
//   },
// ];

// // Tambahan: Membersihkan token kedaluwarsa
// const cleanExpiredResetTokens = async () => {
//   try {
//     await pool.query('DELETE FROM lupapassword WHERE expires_at < NOW() OR is_used = TRUE');
//     console.log('Expired reset tokens cleaned');
//   } catch (error) {
//     console.error('Error membersihkan token kedaluwarsa:', error);
//   }
// };

// module.exports = {
//   requestResetPassword,
//   resetPassword,
//   cleanExpiredResetTokens,
// };

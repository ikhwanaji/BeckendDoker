// server.js

const express = require('express');
const passport = require('./config/passport');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./config/db'); // Impor koneksi database

const app = express();
const PORT = process.env.PORT ;

// Middleware
app.use(bodyParser.json());
app.use(passport.initialize());

// Contoh route yang dilindungi
app.get('/protected', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.user, // Informasi pengguna yang terautentikasi
  });
});

// Route untuk login dan mendapatkan token
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Cari pengguna berdasarkan email
    const [results] = await db.query('SELECT id, email, password, nama, role FROM users WHERE email = ?', [email]);

    if (results.length === 0) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    const user = results[0];

    // Verifikasi password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    // Jika berhasil, buat JWT
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mulai server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

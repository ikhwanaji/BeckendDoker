const db = require('../config/db');

// Konstanta untuk roles yang diizinkan
const ALLOWED_ROLES = ['admin', 'user'];

// Fungsi untuk memeriksa dan mereset auto increment
const resetAutoIncrement = (callback) => {
  const query = `
    SELECT MAX(id) as max_id FROM users;
  `;

  db.query(query, (err, results) => {
    if (err) {
      return callback(err);
    }

    const maxId = results[0].max_id || 0;
    
    // Reset AUTO_INCREMENT ke nilai maksimum + 1
    const resetQuery = `
      ALTER TABLE users AUTO_INCREMENT = ${maxId + 1};
    `;

    db.query(resetQuery, (resetErr) => {
      callback(resetErr);
    });
  });
};

// Mendapatkan semua pengguna
const getUsers = (req, res) => {
  const query = 'SELECT * FROM users';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ 
        error: 'Gagal mendapatkan data pengguna',
        details: err.message 
      });
    }
    res.status(200).json(results);
  });
};

// Menambahkan pengguna baru dengan reset auto increment
const addUser = (req, res) => {
  const { nama, email, password, no_hp, role } = req.body;

  // Validasi input
  if (!nama || !email || !password || !no_hp || !role) {
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  }

  // Validasi role
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role tidak valid' });
  }

  // Cek apakah email sudah ada
  const checkEmailQuery = 'SELECT * FROM users WHERE email = ?';
  
  db.query(checkEmailQuery, [email], (checkErr, checkResults) => {
    if (checkErr) {
      return res.status(500).json({ 
        error: 'Gagal memeriksa email',
        details: checkErr.message 
      });
    }

    // Jika email sudah ada
    if (checkResults.length > 0) {
      return res.status(400).json({ error: 'Email sudah terdaftar' });
    }

    // Query untuk menambahkan pengguna baru
    const insertQuery = `
      INSERT INTO users 
      (nama, email, password, no_hp, role, created_at, update_at) 
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;

    db.query(insertQuery, [nama, email, password, no_hp, role], (insertErr, result) => {
      if (insertErr) {
        // Jika error akibat auto increment
        if (insertErr.code === 'ER_AUTO_INCREMENT_VALUE') {
          // Reset auto increment
          resetAutoIncrement((resetErr) => {
            if (resetErr) {
              return res.status(500).json({ 
                error: 'Gagal mereset auto increment',
                details: resetErr.message 
              });
            }

            // Coba insert ulang setelah reset
            db.query(insertQuery, [nama, email, password, no_hp, role], (retryErr, retryResult) => {
              if (retryErr) {
                return res.status(500).json({ 
                  error: 'Gagal menambahkan pengguna setelah reset',
                  details: retryErr.message 
                });
              }

              res.status(201).json({
                message: 'Pengguna berhasil ditambahkan setelah reset',
                userId: retryResult.insertId,
              });
            });
          });
        } else {
          return res.status(500).json({ 
            error: 'Gagal menambahkan pengguna',
            details: insertErr.message 
          });
        }
      } else {
        res.status(201).json({
          message: 'Pengguna berhasil ditambahkan',
          userId: result.insertId,
        });
      }
    });
  });
};

// Menghapus pengguna berdasarkan ID
const deleteUser = (req, res) => {
  const userId = req.params.id;

  // Validasi ID
  if (!userId) {
    return res.status(400).json({ error: 'ID pengguna tidak valid' });
  }

  // Query untuk menghapus pengguna
  const query = 'DELETE FROM users WHERE id = ?';
  
  db.query(query, [userId], (err, result) => {
    if (err) {
      return res.status(500).json({ 
        error: 'Gagal menghapus pengguna',
        details: err.message 
      });
    }

    // Memeriksa apakah pengguna ditemukan dan dihapus
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    // Reset auto increment setelah penghapusan
    resetAutoIncrement((resetErr) => {
      if (resetErr) {
        console.error('Gagal mereset auto increment:', resetErr);
      }
    });

    res.status(200).json({ message: 'Pengguna berhasil dihapus' });
  });
};

// Memperbarui pengguna berdasarkan ID
const updateUser = (req, res) => {
  const userId = req.params.id;
  const { nama, email, no_hp, role } = req.body;

  // Validasi input
  if (!nama || !email || !no_hp || !role) {
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  }

  // Validasi role
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role tidak valid' });
  }

  // Query untuk memperbarui pengguna dengan update_at
  const query = `
    UPDATE users 
    SET nama = ?, email = ?, no_hp = ?, role = ?, update_at = NOW() 
    WHERE id = ?
  `;

  db.query(query, [nama, email, no_hp, role, userId], (err, result) => {
    if (err) {
      return res.status(500).json({ 
        error: 'Gagal memperbarui pengguna',
        details: err.message 
      });
    }

    // Memeriksa apakah pengguna ditemukan dan diperbarui
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    res.status(200).json({ message: 'Pengguna berhasil diperbarui' });
  });
};

module.exports = {
  getUsers,
  addUser,
  deleteUser,
  updateUser,
  resetAutoIncrement
};
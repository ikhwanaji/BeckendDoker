const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');

const getArtikelImage = (req, res) => {
  const { filename } = req.params;

  // Tentukan direktori penyimpanan gambar
  const imagePath = path.join(__dirname, '../uploads/artikel', filename);

  // Cek apakah file ada
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      // Jika file tidak ditemukan, kirim gambar default
      const defaultImagePath = path.join(__dirname, '../uploads/default-artikel.jpg');
      return res.sendFile(defaultImagePath);
    }

    // Kirim file gambar
    res.sendFile(imagePath);
  });
};

const uploadProfileImage = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Cek apakah file gambar diunggah
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak ada gambar yang diunggah',
      });
    }

    // Dapatkan nama file gambar
    const gambarPath = req.file.filename;

    // Ambil data pengguna untuk menghapus gambar lama
    const [existingUser] = await pool.query('SELECT gambar FROM users WHERE userId = ?', [userId]);

    // Hapus gambar lama jika ada
    if (existingUser[0].gambar) {
      const oldImagePath = path.join('uploads/users', existingUser[0].gambar);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Update path gambar di database
    await pool.query('UPDATE users SET gambar = ? WHERE userId = ?', [gambarPath, userId]);

    // Konstruksi URL gambar
    const profileImageUrl = `/api/users/profile-image/${gambarPath}`;

    res.status(200).json({
      status: 'success',
      message: 'Gambar profil berhasil diperbarui',
      data: {
        gambar: profileImageUrl,
      },
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengunggah gambar profil',
      details: error.message,
    });
  }
};

const getProfileImage = (req, res) => {
  const { filename } = req.params;

  // Tentukan direktori penyimpanan gambar
  const imagePath = path.join(__dirname, '../uploads/users', filename);

  // Cek apakah file ada
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      // Jika file tidak ditemukan, kirim gambar default
      const defaultImagePath = path.join(__dirname, '../uploads/default-profile.jpg');
      return res.sendFile(defaultImagePath);
    }

    // Kirim file gambar
    res.sendFile(imagePath);
  });
};

const deleteProfileImage = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Ambil data pengguna untuk mendapatkan path gambar saat ini
    const [user] = await pool.query('SELECT gambar FROM users WHERE userId = ?', [userId]);

    if (user[0].gambar) {
      // Hapus file gambar dari sistem file
      const imagePath = path.join('uploads/users', user[0].gambar);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      // Set gambar menjadi null di database
      await pool.query('UPDATE users SET gambar = NULL WHERE userId = ?', [userId]);
    }

    res.status(200).json({
      status: 'success',
      message: 'Gambar profil berhasil dihapus',
      data: { gambar: null },
    });
  } catch (error) {
    console.error('Error deleting profile image:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus gambar profil',
      details: error.message,
    });
  }
};

const uploadProdukImage = async (req, res) => {
  try {
    // Cek apakah file gambar diunggah
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak ada gambar yang diunggah',
      });
    }

    // Dapatkan nama file gambar
    const gambarPath = req.file.filename;

    // Simpan path gambar ke database (sesuaikan dengan struktur tabel Anda)
    await pool.query('INSERT INTO produk (gambar) VALUES (?)', [gambarPath]);

    // Konstruksi URL gambar
    const produkImageUrl = `/api/produk/image/${gambarPath}`;

    res.status(200).json({
      status: 'success',
      message: 'Gambar produk berhasil diunggah',
      data: {
        gambar: produkImageUrl,
      },
    });
  } catch (error) {
    console.error('Error uploading produk image:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengunggah gambar produk',
      details: error.message,
    });
  }
};

const updateProdukImage = async (req, res) => {
  const { id } = req.params;

  try {
    // Cek apakah file gambar diunggah
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak ada gambar yang diunggah',
      });
    }

    // Ambil data produk untuk menghapus gambar lama
    const [existingProduk] = await pool.query('SELECT gambar FROM produk WHERE id = ?', [id]);

    // Hapus gambar lama jika ada
    if (existingProduk[0].gambar) {
      const oldImagePath = path.join('uploads/produks', existingProduk[0].gambar);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Dapatkan nama file gambar baru
    const gambarPath = req.file.filename;

    // Update path gambar di database
    await pool.query('UPDATE produk SET gambar = ? WHERE id = ?', [gambarPath, id]);

    // Konstruksi URL gambar
    const produkImageUrl = `/api/produk/image/${gambarPath}`;

    res.status(200).json({
      status: 'success',
      message: 'Gambar produk berhasil diperbarui',
      data: {
        gambar: produkImageUrl,
      },
    });
  } catch (error) {
    console.error('Error updating produk image:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui gambar produk',
      details: error.message,
    });
  }
};

const getProdukImage = (req, res) => {
  const { filename } = req.params;

  // Tentukan direktori penyimpanan gambar
  const imagePath = path.join(__dirname, '../uploads/produks', filename);

  // Cek apakah file ada
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      // Jika file tidak ditemukan, kirim gambar default
      const defaultImagePath = path.join(__dirname, '../uploads/default-produk.jpg');
      return res.sendFile(defaultImagePath);
    }

    // Kirim file gambar
    res.sendFile(imagePath);
  });
};

const deleteProdukImage = async (req, res) => {
  const { id } = req.params;

  try {
    // Ambil data produk untuk mendapatkan path gambar saat ini
    const [produk] = await pool.query('SELECT gambar FROM produk WHERE id = ?', [id]);

    if (produk[0].gambar) {
      // Hapus file gambar dari sistem file
      const imagePath = path.join('uploads/produks', produk[0].gambar);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      // Set gambar menjadi null di database
      await pool.query('UPDATE produk SET gambar = NULL WHERE id = ?', [id]);
    }

    res.status(200).json({
      status: 'success',
      message: 'Gambar produk berhasil dihapus',
      data: { gambar: null },
    });
  } catch (error) {
    console.error('Error deleting produk image:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus gambar produk',
      details: error.message,
    });
  }
};

const getPaketImage = (req, res) => {
  const { filename } = req.params;

  // Tentukan direktori penyimpanan gambar
  const imagePath = path.join(__dirname, '../uploads/paket', filename);

  // Cek apakah file ada
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      // Jika file tidak ditemukan, kirim gambar default
      const defaultImagePath = path.join(__dirname, '../uploads/default-produk.jpg');
      return res.sendFile(defaultImagePath);
    }

    // Kirim file gambar
    res.sendFile(imagePath);
  });
};

module.exports = {
  getArtikelImage,
  uploadProfileImage,
  getProfileImage,
  deleteProfileImage,
  uploadProdukImage,
  updateProdukImage,
  getProdukImage,
  deleteProdukImage,
  getPaketImage,
};

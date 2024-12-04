const { pool } = require('../config/db');
const fs = require('fs').promises;
const path = require('path');

// Tambah Produk
const tambahProduk = async (req, res) => {
  const connection = await pool.getConnection();

  // Ambil data dari body dan file
  const { kategoriId, nama, deskripsi, harga, stok } = req.body;
  const gambar = req.file ? req.file.filename : null;

  // Validasi input
  if (!nama || !kategoriId || !harga) {
    // Hapus file gambar jika ada
    if (gambar) {
      await fs.unlink(path.join('uploads/produks', gambar)).catch(console.error);
    }
    return res.status(400).json({
      status: 'error',
      message: 'Nama, kategori, dan harga harus diisi',
    });
  }

  const query = `
      INSERT INTO produk 
      (kategoriId, nama, deskripsi, harga, stok, gambar, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

  try {
    const [result] = await connection.execute(query, [kategoriId, nama, deskripsi || null, harga, stok || 0, gambar]);

    res.status(201).json({
      status: 'success',
      message: 'Produk berhasil ditambahkan',
      produk: {
        produkId: result.insertId,
        nama,
        kategoriId,
        deskripsi,
        harga,
        stok: stok || 0,
        gambar: gambar ? `uploads/produks/${gambar}` : null,
      },
    });
  } catch (error) {
    // Hapus file gambar jika ada kesalahan
    if (gambar) {
      await fs.unlink(path.join('uploads/produks', gambar)).catch(console.error);
    }

    console.error('Error menambahkan produk:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal menambahkan produk',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

// Dapatkan Semua Produk
const semuaProduk = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const query = `
      SELECT 
        p.*, 
        k.nama AS kategori_nama 
      FROM produk p
      JOIN kategori k ON p.kategoriId = k.kategoriId
      ORDER BY p.created_at DESC
    `;

    const [produk] = await connection.execute(query);

    res.status(200).json({
      status: 'success',
      total: produk.length,
      produk: produk.map((p) => ({
        produkId: p.produkId,
        nama: p.nama,
        kategoriId: p.kategoriId,
        kategoriNama: p.kategori_nama,
        deskripsi: p.deskripsi,
        harga: p.harga,
        stok: p.stok,
        gambar: p.gambar,
        createdAt: p.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Gagal mendapatkan produk',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

// Dapatkan Produk Berdasarkan ID
const produkById = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    const query = `
      SELECT 
        p.*, 
        k.nama AS kategori_nama 
      FROM produk p
      JOIN kategori k ON p.kategoriId = k.kategoriId
      WHERE p.produkId = ?
    `;

    const [produk] = await connection.execute(query, [id]);

    if (produk.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Produk tidak ditemukan',
      });
    }

    const p = produk[0];
    res.status(200).json({
      status: 'success',
      produk: {
        produkId: p.produkId,
        nama: p.nama,
        kategoriId: p.kategoriId,
        kategoriNama: p.kategori_nama,
        deskripsi: p.deskripsi,
        harga: p.harga,
        stok: p.stok,
        gambar: p.gambar,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Gagal mendapatkan produk',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

// Update Produk
const updateProduk = async (req, res) => {
  const { id } = req.params;
  const { kategoriId, nama, deskripsi, harga, stok } = req.body;
  const gambar = req.file ? req.file.filename : null;

  const connection = await pool.getConnection();

  try {
    // Mulai transaksi
    await connection.beginTransaction();

    // Cari produk yang ada
    const [existingProduk] = await connection.query('SELECT gambar FROM produk WHERE produkId = ?', [id]);

    if (existingProduk.length === 0) {
      // Hapus file gambar baru jika produk tidak ditemukan
      if (gambar) {
        await fs.unlink(path.join('uploads/produks', gambar)).catch(console.error);
      }
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Produk tidak ditemukan',
      });
    }

    // Validasi input
    if (!nama || !kategoriId || !harga) {
      // Hapus file gambar baru jika ada
      if (gambar) {
        await fs.unlink(path.join('uploads/produks', gambar)).catch(console.error);
      }
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Nama, kategori, dan harga harus diisi',
      });
    }

    // Siapkan query update
    let query = `
        UPDATE produk 
        SET 
          kategoriId = ?, 
          nama = ?, 
          deskripsi = ?, 
          harga = ?, 
          stok = ?, 
          updated_at = NOW()
      `;
    const queryParams = [kategoriId, nama, deskripsi || null, harga, stok || 0];

    // Tambahkan gambar ke update jika ada
    if (gambar) {
      query += ', gambar = ?';
      queryParams.push(gambar);

      // Hapus gambar lama jika ada
      if (existingProduk[0].gambar) {
        await fs.unlink(path.join('uploads/produks', existingProduk[0].gambar)).catch(console.error);
      }
    }

    query += ' WHERE produkId = ?';
    queryParams.push(id);

    // Eksekusi query
    const [result] = await connection.execute(query, queryParams);

    // Commit transaksi
    await connection.commit();

    res.status(200).json({
      status: 'success',
      message: 'Produk berhasil diupdate',
      produk: {
        produkId: id,
        nama,
        kategoriId,
        deskripsi,
        harga,
        stok: stok || 0,
        gambar: gambar ? `uploads/produks/${gambar}` : existingProduk[0].gambar,
      },
    });
  } catch (error) {
    // Rollback transaksi
    await connection.rollback();

    // Hapus file gambar baru jika ada kesalahan
    if (gambar) {
      await fs.unlink(path.join('uploads/produks', gambar)).catch(console.error);
    }

    console.error('Error update produk:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal update produk',
      details: error.message,
    });
  } finally {
    // Pastikan koneksi ditutup
    connection.release();
  }
};

// Hapus Produk
const hapusProduk = async (req, res) => {
  const { id } = req.params;

  // Dapatkan koneksi dari pool
  const connection = await pool.getConnection();

  try {
    // Mulai transaksi
    await connection.beginTransaction();

    // Cari produk untuk mendapatkan nama file gambar
    const [existingProduk] = await connection.query('SELECT gambar FROM produk WHERE produkId = ?', [id]);

    if (existingProduk.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Produk tidak ditemukan',
      });
    }

    // Hapus gambar jika ada
    if (existingProduk[0].gambar) {
      await fs.unlink(path.join('uploads/produks', existingProduk[0].gambar)).catch(console.error);
    }

    // Hapus produk dari database
    const [deleteResult] = await connection.query('DELETE FROM produk WHERE produkId = ?', [id]);

    if (deleteResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Produk tidak ditemukan',
      });
    }

    // Dapatkan ID maksimum saat ini
    const [maxIdResult] = await connection.query('SELECT COALESCE(MAX(produkId), 0) as maxId FROM produk');
    const maxId = maxIdResult[0].maxId;

    // Reset AUTO_INCREMENT
    await connection.query(`ALTER TABLE produk AUTO_INCREMENT = ${maxId + 1}`);

    // Commit transaksi
    await connection.commit();

    res.status(200).json({
      status: 'success',
      message: 'Produk berhasil dihapus',
      produkId: id,
      currentMaxId: maxId,
    });
  } catch (error) {
    // Rollback transaksi jika terjadi kesalahan
    await connection.rollback();

    console.error('Error menghapus produk:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus produk',
      details: error.message,
    });
  } finally {
    // Pastikan koneksi ditutup
    connection.release();
  }
};

module.exports = {
  tambahProduk,
  semuaProduk,
  produkById,
  updateProduk,
  hapusProduk,
};

const { pool } = require('../config/db');
const fs = require('fs').promises;
const path = require('path');

// GET semua penyakit

const getAllPenyakit = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM penyakit');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data penyakit' });
  }
};

// GET berdasarkan ID
const getPenyakitById = async (req, res) => {
  const { PenyakitId } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM penyakit WHERE PenyakitId = ?', [PenyakitId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Penyakit tidak ditemukan' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data' });
  }
};

// POST tambah penyakit
const createPenyakit = async (req, res) => {
  const { nama, kategori, deskripsi, penyebab, gejala, pencegahan, pengobatan, referensi, info_tambahan } = req.body;

  // Store just the filename rather than full path
  const gambar = req.file ? req.file.filename : null;

  // Tambahkan timestamp untuk created_at dan updated_at
  const created_at = new Date();
  const updated_at = created_at;

  try {
    const [result] = await pool.query(
      `
      INSERT INTO penyakit
      (nama, kategori, deskripsi, penyebab, gejala, pencegahan, pengobatan, referensi, info_tambahan, gambar, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [nama, kategori, deskripsi, penyebab, gejala, pencegahan, pengobatan, referensi, info_tambahan, gambar, created_at, updated_at]
    );

    res.status(201).json({ message: 'Penyakit berhasil ditambahkan', PenyakitId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menambahkan penyakit' });
  }
};

// Update updatePenyakit similarly:
const updatePenyakit = async (req, res) => {
  const { PenyakitId } = req.params;
  const { nama, kategori, deskripsi, penyebab, gejala, pencegahan, pengobatan, referensi, info_tambahan } = req.body;
  const gambar = req.file ? req.file.filename : null;

  const connection = await pool.getConnection();

  try {
    // Mulai transaksi
    await connection.beginTransaction();

    // Cari penyakit yang ada
    const [existingPenyakit] = await connection.query('SELECT gambar FROM penyakit WHERE PenyakitId = ?', [PenyakitId]);

    if (existingPenyakit.length === 0) {
      // Hapus file gambar baru jika penyakit tidak ditemukan
      if (gambar) {
        await fs.unlink(path.join('uploads/artikel', gambar)).catch(console.error);
      }
      await connection.rollback();
      return res.status(404).json({ error: 'Penyakit tidak ditemukan' });
    }

    // Siapkan query update
    let query = `
      UPDATE penyakit 
      SET nama = ?, kategori = ?, deskripsi = ?, penyebab = ?, gejala = ?,
      pencegahan = ?, pengobatan = ?, referensi = ?, info_tambahan = ?, updated_at = NOW()
    `;
    const queryParams = [nama, kategori, deskripsi, penyebab, gejala, pencegahan, pengobatan, referensi, info_tambahan];

    // Tambahkan gambar ke update jika ada
    if (gambar) {
      query += ', gambar = ?';
      queryParams.push(gambar);

      // Hapus gambar lama jika ada
      if (existingPenyakit[0].gambar) {
        await fs.unlink(path.join('uploads/artikel', existingPenyakit[0].gambar)).catch(console.error);
      }
    }

    query += ' WHERE PenyakitId = ?';
    queryParams.push(PenyakitId);

    // Eksekusi query
    await connection.query(query, queryParams);

    // Commit transaksi
    await connection.commit();

    res.json({ message: 'Penyakit berhasil diperbarui' });
  } catch (error) {
    // Rollback transaksi
    await connection.rollback();

    // Hapus file gambar baru jika ada kesalahan
    if (gambar) {
      await fs.unlink(path.join('uploads/artikel', gambar)).catch(console.error);
    }

    console.error('Error updating penyakit:', error);
    res.status(500).json({ error: 'Gagal memperbarui penyakit' });
  } finally {
    // Pastikan koneksi ditutup
    connection.release();
  }
};

// DELETE penyakit
const deletePenyakit = async (req, res) => {
  const { PenyakitId } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM penyakit WHERE PenyakitId = ?', [PenyakitId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Penyakit tidak ditemukan' });

    res.json({ message: 'Penyakit berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus penyakit' });
  }
};

// Ekspor semua controller dan middleware
module.exports = {
  getAllPenyakit,
  getPenyakitById,
  createPenyakit,
  updatePenyakit,
  deletePenyakit,
};

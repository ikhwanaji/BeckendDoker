// src/controllers/artikelController.js
const { pool } = require('../config/db');
const fs = require('fs').promises;
const path = require('path');

// Fungsi untuk membuat artikel baru
const createArtikel = async (req, res) => {
  const { judul, konten, status, publish } = req.body;
  const gambar = req.file ? req.file.filename : null;

  // Validasi input
  if (!judul || !konten) {
    // Hapus file gambar jika ada
    if (gambar) {
      await fs.unlink(path.join('uploads/artikel', gambar)).catch(console.error);
    }
    return res.status(400).json({ error: 'Judul dan konten harus diisi' });
  }

  const query = `
    INSERT INTO artikel 
    (judul, konten, gambar, status, publish, created_at, updated_at) 
    VALUES 
    (?, ?, ?, ?, ?, NOW(), NOW())
  `;

  try {
    const [results] = await pool.query(query, [judul, konten, gambar, status || 'draft', publish || false]);

    res.status(201).json({
      message: 'Artikel berhasil dibuat',
      artikelId: results.insertId,
    });
  } catch (error) {
    // Hapus file gambar jika ada kesalahan
    if (gambar) {
      await fs.unlink(path.join('uploads/artikel', gambar)).catch(console.error);
    }
    console.error('Error creating artikel:', error);
    res.status(500).json({ error: 'Gagal membuat artikel' });
  }
};

// Fungsi untuk mendapatkan semua artikel
const getArtikel = async (req, res) => {
  const { status, publish } = req.query;

  let query = 'SELECT * FROM artikel WHERE 1=1';
  const queryParams = [];

  // Filter berdasarkan status
  if (status) {
    query += ' AND status = ?';
    queryParams.push(status);
  }

  // Filter berdasarkan publish
  if (publish !== undefined) {
    query += ' AND publish = ?';
    queryParams.push(publish === 'true');
  }

  query += ' ORDER BY created_at DESC';

  try {
    const [results] = await pool.query(query, queryParams);

    // Format tanggal
    const formattedResults = results.map((artikel) => ({
      ...artikel,
      created_at: artikel.created_at.toISOString().split('T')[0],
      updated_at: artikel.updated_at.toISOString().split('T')[0],
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Error fetching artikel:', error);
    res.status(500).json({ error: 'Gagal mengambil artikel' });
  }
};

// Fungsi untuk mendapatkan artikel berdasarkan ID
const getArtikelById = async (req, res) => {
  const { artikelId } = req.params;

  const query = 'SELECT * FROM artikel WHERE artikelId = ?';

  try {
    const [results] = await pool.query(query, [artikelId]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Artikel tidak ditemukan' });
    }

    const artikel = results[0];
    artikel.created_at = artikel.created_at.toISOString().split('T')[0];
    artikel.updated_at = artikel.updated_at.toISOString().split('T')[0];

    res.json(artikel);
  } catch (error) {
    console.error('Error fetching artikel by ID:', error);
    res.status(500).json({ error: 'Gagal mengambil artikel' });
  }
};

// Fungsi untuk update artikel
const updateArtikel = async (req, res) => {
  const { artikelId } = req.params;
  const { judul, konten, status, publish } = req.body;
  const gambar = req.file ? req.file.filename : null;

  const connection = await pool.getConnection();

  try {
    // Mulai transaksi
    await connection.beginTransaction();

    // Cari artikel yang ada
    const [existingArtikel] = await connection.query('SELECT gambar FROM artikel WHERE artikelId = ?', [artikelId]);

    if (existingArtikel.length === 0) {
      // Hapus file gambar baru jika artikel tidak ditemukan
      if (gambar) {
        await fs.unlink(path.join('uploads/artikel', gambar)).catch(console.error);
      }
      await connection.rollback();
      return res.status(404).json({ error: 'Artikel tidak ditemukan' });
    }

    // Siapkan query update
    let query = `
      UPDATE artikel 
      SET judul = ?, konten = ?, updated_at = NOW()
    `;
    const queryParams = [judul, konten];

    // Tambahkan gambar ke update jika ada
    if (gambar) {
      query += ', gambar = ?';
      queryParams.push(gambar);

      // Hapus gambar lama jika ada
      if (existingArtikel[0].gambar) {
        await fs.unlink(path.join('uploads/artikel', existingArtikel[0].gambar)).catch(console.error);
      }
    }

    // Tambahkan status dan publish jika disediakan
    if (status) {
      query += ', status = ?';
      queryParams.push(status);
    }

    if (publish !== undefined) {
      query += ', publish = ?';
      queryParams.push(publish);
    }

    query += ' WHERE artikelId = ?';
    queryParams.push(artikelId);

    // Eksekusi query
    await connection.query(query, queryParams);

    // Commit transaksi
    await connection.commit();

    res.json({ message: 'Artikel berhasil diperbarui' });
  } catch (error) {
    // Rollback transaksi
    await connection.rollback();

    // Hapus file gambar baru jika ada kesalahan
    if (gambar) {
      await fs.unlink(path.join('uploads/artikel', gambar)).catch(console.error);
    }

    console.error('Error updating artikel:', error);
    res.status(500).json({ error: 'Gagal memperbarui artikel' });
  } finally {
    // Pastikan koneksi ditutup
    connection.release();
  }
};

// fungsi deleteArtikel
const deleteArtikel = async (req, res) => {
  const { artikelId } = req.params;

  // Dapatkan koneksi dari pool
  const connection = await pool.getConnection();

  try {
    // Mulai transaksi
    await connection.beginTransaction();

    // Cari artikel untuk mendapatkan nama file gambar
    const [existingArtikel] = await connection.query('SELECT gambar FROM artikel WHERE artikelId = ?', [artikelId]);

    if (existingArtikel.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Artikel tidak ditemukan' });
    }

    // Hapus gambar jika ada
    if (existingArtikel[0].gambar) {
      await fs.unlink(path.join('uploads/artikel', existingArtikel[0].gambar)).catch(console.error);
    }

    // Hapus artikel dari database
    const [deleteResult] = await connection.query('DELETE FROM artikel WHERE artikelId = ?', [artikelId]);

    if (deleteResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Artikel tidak ditemukan' });
    }

    // Dapatkan ID maksimum saat ini
    const [maxIdResult] = await connection.query('SELECT COALESCE(MAX(artikelId), 0) as maxId FROM artikel');
    const maxId = maxIdResult[0].maxId;

    // Reset AUTO_INCREMENT
    await connection.query(`ALTER TABLE artikel AUTO_INCREMENT = ${maxId + 1}`);

    // Commit transaksi
    await connection.commit();

    res.json({
      message: 'Artikel berhasil dihapus',
      currentMaxId: maxId,
    });
  } catch (error) {
    // Rollback transaksi jika terjadi kesalahan
    await connection.rollback();
    console.error('Error deleting artikel:', error);
    res.status(500).json({ error: 'Gagal menghapus artikel' });
  } finally {
    // Pastikan koneksi ditutup
    connection.release();
  }
};

// Fungsi untuk mencari artikel
const searchArtikel = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Kata kunci pencarian diperlukan' });
  }

  const searchQuery = `
    SELECT * FROM artikel 
    WHERE judul LIKE ? OR konten LIKE ? 
    ORDER BY created_at DESC
  `;

  try {
    const [results] = await pool.query(searchQuery, [`%${query}%`, `%${query}%`]);

    // Format tanggal
    const formattedResults = results.map((artikel) => ({
      ...artikel,
      created_at: artikel.created_at.toISOString().split('T')[0],
      updated_at: artikel.updated_at.toISOString().split('T')[0],
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Error searching artikel:', error);
    res.status(500).json({ error: 'Gagal mencari artikel' });
  }
};

// Fungsi untuk mendapatkan artikel terbaru
const getLatestArtikel = async (req, res) => {
  const { limit = 5 } = req.query;

  const query = `
    SELECT * FROM artikel 
    WHERE publish = true 
    ORDER BY created_at DESC 
    LIMIT ?
  `;

  try {
    const [results] = await pool.query(query, [parseInt(limit)]);

    // Format tanggal
    const formattedResults = results.map((artikel) => ({
      ...artikel,
      created_at: artikel.created_at.toISOString().split('T')[0],
      updated_at: artikel.updated_at.toISOString().split('T')[0],
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Error fetching latest artikel:', error);
    res.status(500).json({ error: 'Gagal mengambil artikel terbaru' });
  }
};

// Ekspor semua fungsi
module.exports = {
  createArtikel,
  getArtikel,
  getArtikelById,
  updateArtikel,
  deleteArtikel,
  searchArtikel,
  getLatestArtikel,
};

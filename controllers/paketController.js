const { pool } = require('../config/db');
const path = require('path');
const fs = require('fs').promises;

// Mendapatkan semua paket
const getAllPaket = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM paket');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving paket', error });
  }
};

// Menambahkan paket baru
const addPaket = async (req, res) => {
  const { title, harga, items } = req.body;
  const gambar = req.file ? req.file.filename : null;

  // Validasi input
  if (!title || !harga) {
    // Hapus file gambar jika ada
    if (gambar) {
      await fs.unlink(path.join('uploads/paket', gambar)).catch(console.error);
    }
    return res.status(400).json({ error: 'Title dan harga harus diisi' });
  }

  const query = `
        INSERT INTO paket 
        (title, harga, gambar, items, created_at, updated_at) 
        VALUES 
        (?, ?, ?, ?, NOW(), NOW())
    `;

  try {
    const [result] = await pool.query(query, [title, harga, gambar, items]);

    res.status(201).json({
      message: 'Paket berhasil ditambahkan',
      paketId: result.insertId,
      title,
      harga,
      gambar,
      items,
    });
  } catch (error) {
    // Hapus file gambar jika ada kesalahan
    if (gambar) {
      await fs.unlink(path.join('uploads/paket', gambar)).catch(console.error);
    }
    console.error('Error adding paket:', error);
    res.status(500).json({ message: 'Gagal menambahkan paket', error });
  }
};

const getPaketById = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { paketId } = req.params;

    const query = `
      SELECT 
        p.*
      FROM paket p
      WHERE p.paketId = ?
    `;

    const [paket] = await connection.execute(query, [paketId]);

    if (paket.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Paket tidak ditemukan',
      });
    }

    const p = paket[0];
    res.status(200).json({
      status: 'success',
      paket: {
        paketId: p.paketId,
        title: p.title,
        harga: p.harga,
        items: p.items,
        gambar: p.gambar,
        status: p.status,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Gagal mendapatkan paket',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

// Mengupdate paket
const updatePaket = async (req, res) => {
  const { paketId } = req.params;
  const { title, harga, items, status } = req.body;
  const gambar = req.file ? req.file.filename : null;

  const connection = await pool.getConnection();

  try {
    // Mulai transaksi
    await connection.beginTransaction();

    // Cari paket yang ada
    const [existingPaket] = await connection.query('SELECT gambar FROM paket WHERE paketId = ?', [paketId]);

    if (existingPaket.length === 0) {
      // Hapus file gambar baru jika paket tidak ditemukan
      if (gambar) {
        await fs.unlink(path.join('uploads/paket', gambar)).catch(console.error);
      }
      await connection.rollback();
      return res.status(404).json({ error: 'Paket tidak ditemukan' });
    }

    // Validasi input minimal
    if (!title || !harga) {
      // Hapus file gambar baru jika ada
      if (gambar) {
        await fs.unlink(path.join('uploads/paket', gambar)).catch(console.error);
      }
      await connection.rollback();
      return res.status(400).json({ error: 'Title dan harga harus diisi' });
    }

    // Siapkan query update
    let query = `
            UPDATE paket 
            SET title = ?, harga = ?, items = ?, updated_at = NOW()
        `;
    const queryParams = [title, harga, items];

    // Tambahkan gambar ke update jika ada
    if (gambar) {
      query += ', gambar = ?';
      queryParams.push(gambar);

      // Hapus gambar lama jika ada
      if (existingPaket[0].gambar) {
        await fs.unlink(path.join('uploads/paket', existingPaket[0].gambar)).catch(console.error);
      }
    }

    // Tambahkan status jika disediakan
    if (status) {
      query += ', status = ?';
      queryParams.push(status);
    }

    query += ' WHERE paketId = ?';
    queryParams.push(paketId);

    // Eksekusi query
    await connection.query(query, queryParams);

    // Commit transaksi
    await connection.commit();

    res.json({
      message: 'Paket berhasil diperbarui',
      updatedData: {
        paketId,
        title,
        harga,
        items,
        gambar: gambar || existingPaket[0].gambar,
        status,
      },
    });
  } catch (error) {
    // Rollback transaksi
    await connection.rollback();

    // Hapus file gambar baru jika ada kesalahan
    if (gambar) {
      await fs.unlink(path.join('uploads/paket', gambar)).catch(console.error);
    }

    console.error('Error updating paket:', error);
    res.status(500).json({ error: 'Gagal memperbarui paket', details: error.message });
  } finally {
    // Pastikan koneksi ditutup
    connection.release();
  }
};

// Menghapus paket
const deletePaket = async (req, res) => {
  const { paketId } = req.params;

  // Dapatkan koneksi dari pool
  const connection = await pool.getConnection();

  try {
    // Mulai transaksi
    await connection.beginTransaction();

    // Cari paket untuk mendapatkan nama file gambar
    const [existingPaket] = await connection.query('SELECT gambar FROM paket WHERE paketId = ?', [paketId]);

    if (existingPaket.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Paket tidak ditemukan' });
    }

    // Hapus gambar jika ada
    if (existingPaket[0].gambar) {
      await fs.unlink(path.join('uploads/paket', existingPaket[0].gambar)).catch(console.error);
    }

    // Hapus paket dari database
    const [deleteResult] = await connection.query('DELETE FROM paket WHERE paketId = ?', [paketId]);

    if (deleteResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Paket tidak ditemukan' });
    }

    // Dapatkan ID maksimum saat ini
    const [maxIdResult] = await connection.query('SELECT COALESCE(MAX(paketId), 0) as maxId FROM paket');
    const maxId = maxIdResult[0].maxId;

    // Reset AUTO_INCREMENT
    await connection.query(`ALTER TABLE paket AUTO_INCREMENT = ${maxId + 1}`);

    // Commit transaksi
    await connection.commit();

    res.json({
      message: 'Paket berhasil dihapus',
      deletedPaketId: paketId,
      currentMaxId: maxId,
    });
  } catch (error) {
    // Rollback transaksi jika terjadi kesalahan
    await connection.rollback();
    console.error('Error deleting paket:', error);
    res.status(500).json({
      error: 'Gagal menghapus paket',
      details: error.message,
    });
  } finally {
    // Pastikan koneksi ditutup
    connection.release();
  }
};

// Ekspor fungsi controller
module.exports = {
  getAllPaket,
  addPaket,
  getPaketById,
  updatePaket,
  deletePaket,
};

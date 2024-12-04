const { pool } = require('../config/db');

exports.getAllKategori = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Ambil semua kategori
    const [kategoris] = await connection.query('SELECT * FROM kategori');
    
    // Hitung jumlah produk per kategori
    const kategorisWithCount = await Promise.all(
      kategoris.map(async (kategori) => {
        const [countResult] = await connection.query(
          'SELECT COUNT(*) as count FROM produk WHERE kategoriId = ?', 
          [kategori.kategoriId]
        );
        return {
          ...kategori,
          count: countResult[0].count
        };
      })
    );

    res.json(kategorisWithCount);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching kategori', 
      error: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.createKategori = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const { nama, deskripsi } = req.body;
    
    const [result] = await connection.query(
      'INSERT INTO kategori (nama, deskripsi) VALUES (?, ?)', 
      [nama, deskripsi]
    );
    
    res.status(201).json({
      kategoriId: result.insertId,
      nama,
      deskripsi
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error creating kategori', 
      error: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.updateKategori = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const { kategoriId } = req.params;
    const { nama, deskripsi } = req.body;
    
    const [result] = await connection.query(
      'UPDATE kategori SET nama = ?, deskripsi = ? WHERE kategoriId = ?', 
      [nama, deskripsi, kategoriId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Kategori not found' });
    }
    
    res.json({ 
      message: 'Kategori updated successfully',
      kategoriId,
      nama,
      deskripsi
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error updating kategori', 
      error: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.deleteKategori = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const { kategoriId } = req.params;
    
    const [result] = await connection.query(
      'DELETE FROM kategori WHERE kategoriId = ?', 
      [kategoriId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Kategori not found' });
    }
    
    res.json({ 
      message: 'Kategori deleted successfully',
      kategoriId 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error deleting kategori', 
      error: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
};

// Tambahan: Fungsi untuk mendapatkan kategori berdasarkan ID
exports.getKategoriById = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const { kategoriId } = req.params;
    
    const [kategoris] = await connection.query(
      'SELECT * FROM kategori WHERE kategoriId = ?', 
      [kategoriId]
    );
    
    if (kategoris.length === 0) {
      return res.status(404).json({ message: 'Kategori not found' });
    }
    
    res.json(kategoris[0]);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching kategori', 
      error: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
};
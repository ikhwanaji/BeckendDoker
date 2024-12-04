const { pool } = require('../config/db'); // Mengimpor pool dari db.js

// Fungsi untuk membuat laporan
const createLaporan = async (req, res) => {
  const { nama, email, pesan } = req.body;

  // Validasi dasar
  if (!nama || !email || !pesan) {
    return res.status(400).json({ error: 'Semua field harus diisi' });
  }

  // Generate a new laporanId (disarankan menggunakan auto-increment di database)
  const laporanId = Math.floor(Math.random() * 1000000); // Simple random ID for demonstration

  const query = 'INSERT INTO laporan (laporanId, nama, email, pesan, created_at) VALUES (?, ?, ?, ?, NOW())';

  try {
    // Menggunakan pool untuk mengeksekusi query
    const [results] = await pool.query(query, [laporanId, nama, email, pesan]);
    res.status(201).json({ pesan: 'Pesan berhasil dikirim', data: { laporanId, nama, email, pesan } });
  } catch (error) {
    console.error('Error inserting data:', error);
    return res.status(500).json({ error: 'Gagal membuat laporan' });
  }
};

// Fungsi untuk mendapatkan laporan
const getLaporan = async (req, res) => {
  const query = 'SELECT * FROM laporan ORDER BY created_at DESC';

  try {
    // Menggunakan pool untuk mengeksekusi query
    const [results] = await pool.query(query);

    // Memformat hasil untuk hanya menampilkan tahun-bulan-tanggal pada created_at
    const formattedResults = results.map((laporan) => {
      return {
        ...laporan,
        created_at: laporan.created_at.toISOString().split('T')[0], // Format YYYY-MM-DD
      };
    });

    res.json(formattedResults);
  } catch (error) {
    console.error('Error fetching data:', error);
    return res.status(500).json({ error: 'Gagal mengambil laporan' });
  }
};

const deleteLaporan = async (req, res) => {
  const { laporanId } = req.params; // Mengambil laporanId dari parameter URL

  // Validasi apakah laporanId ada
  if (!laporanId) {
    return res.status(400).json({ error: 'laporanId harus disediakan' });
  }

  const query = 'DELETE FROM laporan WHERE laporanId = ?';

  try {
    // Menggunakan pool untuk mengeksekusi query
    const [results] = await pool.query(query, [laporanId]);

    // Memeriksa apakah ada baris yang terpengaruh (berarti laporan ditemukan dan dihapus)
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    }

    res.status(200).json({ message: 'Laporan berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting data:', error);
    return res.status(500).json({ error: 'Gagal menghapus laporan' });
  }
};


module.exports = {
  createLaporan,
  getLaporan,
  deleteLaporan
};

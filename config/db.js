require('dotenv').config();
const mysql = require('mysql2/promise'); // Menggunakan mysql2/promise

// Membuat pool koneksi
const pool = mysql.createPool({
  host: process.env.DB_HOST, // Host database
  user: process.env.DB_USER, // Username database
  password: process.env.DB_PASS, // Password database
  database: process.env.DB_NAME, // Nama database
  port: process.env.DB_PORT, // Port database (jika diperlukan)
  waitForConnections: true, // Menunggu koneksi yang tersedia
  connectionLimit: 10, // Batas koneksi bersamaan
  queueLimit: 0, // Batas antrean koneksi
});

// Uji koneksi
const testConnection = async () => {
  try {
    const [rows, fields] = await pool.query('SELECT 1');
    console.log('Terhubung ke database MySQL.');
  } catch (err) {
    console.error('Koneksi ke database gagal:', err.message);
  }
};

testConnection();

module.exports = {
  pool, // Ekspor pool untuk digunakan di bagian lain aplikasi
};

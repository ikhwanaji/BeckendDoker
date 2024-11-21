const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

// Konfigurasi koneksi
const db = mysql.createConnection({
  host: process.env.DB_HOST , // Host database
  user: process.env.DB_USER ,     // Username database
  password: process.env.DB_PASS ,     // Password database
  database: process.env.DB_NAME  // Nama database
});

// Uji koneksi
db.connect((err) => {
  if (err) {
    console.error('Koneksi ke database gagal:', err.message);
    return;
  }
  console.log('Terhubung ke database MySQL.');
});

module.exports = db;

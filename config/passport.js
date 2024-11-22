require('dotenv').config(); // Memuat variabel lingkungan dari file .env
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const db = require('./db'); // Mengimpor koneksi database

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // Gunakan variabel dari .env

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Mengambil token dari header Authorization
  secretOrKey: JWT_SECRET, // Kunci rahasia untuk verifikasi token
};

// Menggunakan strategi JWT
passport.use(
  new JwtStrategy(options, async (jwt_payload, done) => {
    try {
      // Cari user berdasarkan id dari JWT payload
      const [results] = await db.pool.query('SELECT id, email, nama, role FROM users WHERE id = ?', [jwt_payload.id]);

      if (results.length > 0) {
        return done(null, results[0]); // Mengembalikan user pertama jika ditemukan
      }
      return done(null, false); // User tidak ditemukan
    } catch (error) {
      console.error('Error in JWT strategy:', error); // Logging kesalahan
      return done(error, false); // Mengembalikan error jika terjadi kesalahan
    }
  })
);

module.exports = passport; // Mengekspor instance passport

require('dotenv').config(); // Memuat variabel lingkungan dari file .env
const passport = require('passport');
const { ExtractJwt, Strategy: JwtStrategy } = require('passport-jwt');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { pool } = require('./db'); // Mengimpor koneksi database
const JWT_SECRET = process.env.JWT_SECRET;

// Konfigurasi JWT Strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET,
};

// Strategi untuk memverifikasi token
passport.use(
  new JwtStrategy(jwtOptions, async (jwt_payload, done) => {
    try {
      const [results] = await pool.execute('SELECT userId, email, nama, role FROM users WHERE userId = ?', [jwt_payload.id]);
      if (results.length > 0) return done(null, results[0]);
      return done(null, false);
    } catch (error) {
      console.error('Error in JWT strategy:', error);
      return done(error, false);
    }
  })
);

// Konfigurasi Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (request, accessToken, refreshToken, profile, done) => {
      try {
        const [existingUsers] = await pool.execute('SELECT * FROM users WHERE google_id = ? OR email = ?', [profile.id, profile.emails[0].value]);

        if (existingUsers.length > 0) {
          const user = existingUsers[0];
          if (!user.google_id) {
            await pool.execute('UPDATE users SET google_id = ? WHERE userId = ?', [profile.id, user.userId]);
            user.google_id = profile.id;
          }
          return done(null, user);
        }

        const newUser = {
          google_id: profile.id,
          nama: profile.displayName,
          email: profile.emails[0].value,
          role: 'user',
          created_at: new Date(),
          updated_at: new Date(),
        };

        const [result] = await pool.execute('INSERT INTO users (google_id, nama, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', Object.values(newUser));

        newUser.userId = result.insertId;
        return done(null, newUser);
      } catch (error) {
        console.error('Google OAuth Error:', error);
        return done(error, null);
      }
    }
  )
);

// Serialisasi dan deserialisasi pengguna
passport.serializeUser((user, done) => {
  console.log('Serializing user:', user);
  done(null, user.userId); // Gunakan userId untuk serialize
});

passport.deserializeUser(async (id, done) => {
  console.log('Deserializing user with id:', id);
  try {
    const [results] = await pool.query('SELECT * FROM users WHERE userId = ?', [id]);
    done(null, results[0]);
  } catch (error) {
    done(error, null);
  }
});

// Ekspor konfigurasi passport
module.exports = passport;

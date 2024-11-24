require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('./config/db'); // Koneksi ke database
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { authenticate, authorize } = require('./middleware/authMiddleware');
const authRoutes = require('./authRoutes'); // Import authRoutes

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(bodyParser.json());

// Middleware untuk session (jika Anda menggunakan sesi)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Middleware untuk Passport
app.use(passport.initialize());
app.use(passport.session());

app.use(cors());

app.use('/api/auth', authRoutes);

// Konfigurasi Passport untuk Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const [results] = await db.query('SELECT * FROM users WHERE google_id = ?', [profile.id]);

        if (results.length > 0) {
          return cb(null, results[0]);
        } else {
          const newUser = {
            google_id: profile.id,
            email: profile.emails[0].value,
            nama: profile.displayName,
            password: null, // Atur password ke null untuk pengguna Google
            gambar: profile.photos[0].value,
            created_at: new Date(),
            updated_at: new Date(),
          };

          await db.query('INSERT INTO users SET ?', newUser);
          return cb(null, newUser);
        }
      } catch (error) {
        console.error('Error in GoogleStrategy:', error);
        return cb(error, null);
      }
    }
  )
);

// Serialize dan deserialize pengguna
passport.serializeUser((user, done) => {
  done(null, user.google_id); // Gunakan google_id untuk serialize
});

passport.deserializeUser(async (id, done) => {
  try {
    const [results] = await db.query('SELECT * FROM users WHERE google_id = ?', [id]);
    done(null, results[0]);
  } catch (error) {
    done(error, null);
  }
});

// Konfigurasi Passport untuk JWT
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

passport.use(
  new JwtStrategy(opts, async (jwt_payload, done) => {
    try {
      const [results] = await db.query('SELECT * FROM users WHERE google_id = ?', [jwt_payload.id]);
      if (results.length > 0) {
        return done(null, results[0]);
      } else {
        return done(null, false);
      }
    } catch (error) {
      return done(error, false);
    }
  })
);

// Rute untuk login menggunakan email dan password
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  // Validasi input
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = results[0];

    // Verifikasi password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Jika berhasil, buat JWT
    const token = jwt.sign({ id: user.google_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, message: 'Login successful' });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Rute untuk login menggunakan Google
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  // Jika berhasil, buat JWT
  const token = jwt.sign({ id: req.user.google_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, message: 'Login with Google successful' });
});

// Rute yang dilindungi
app.get('/protected', authenticate, (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.user, // Informasi pengguna yang terautentikasi
  });
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

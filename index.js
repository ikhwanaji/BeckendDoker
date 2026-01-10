const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const userRoutes = require('./routes/authRoutes');
const kategoriRoutes = require('./routes/kategoriRoutes');
const produkRoutes = require('./routes/produkRoutes');
const shippingMethodRoutes = require('./routes/shippingMethodRoutes');
const paketRoutes = require('./routes/paketRoutes');
const pemesananRoutes = require('./routes/pemesananRoutes');
const OrderPaketRoutes = require('./routes/OrderPaketRoutes');
const penyakitRouter = require('./routes/penyakitRoute');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

// Konfigurasi environment variables
dotenv.config();

const app = express();
const PORT = process.env.DB_PORT;

// Middleware CORS dengan konfigurasi lebih lengkap
app.use(
  cors({
    origin: [process.env.FRONTEND_URL, process.env.API_URL, 'https://doker-zeta.vercel.app', 'https://7b192837034b.ngrok-free.app'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Body parsing middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware (opsional untuk debugging)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Rute
app.use('/api/auth', userRoutes);
app.use('/api/kategoris', kategoriRoutes);
app.use('/api/produks', produkRoutes);
app.use('/api/shipping-methods', shippingMethodRoutes);
app.use('/api', paketRoutes);
app.use('/api/pemesanan', pemesananRoutes);
app.use('/api/order-paket', OrderPaketRoutes);
app.use('/api/penyakit', penyakitRouter);
app.use(notFoundHandler);
app.use(errorHandler);

// Jalankan server
const startServer = () => {
  try {
    app.listen(PORT, () => {
      console.log(`Server berjalan di http://localhost:${PORT}`);
      console.log(`Lingkungan: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Gagal memulai server:', error);
    process.exit(1);
  }
};

// Tangani proses shutdown dengan baik
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

startServer();

module.exports = app;

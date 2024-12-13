// routes/pemesananRoutes.js
const express = require('express');
const router = express.Router();
const { getRiwayatPemesanan } = require('../controllers/pemesananController');
const { createPemesanan} = require('../controllers/pemesananController');
// Middleware autentikasi 
const { authenticate, authenticateToken } = require('../middleware/authMiddleware');

// Rute untuk membuat pemesanan (membutuhkan autentikasi)
router.post('/create', authenticate, authenticateToken, createPemesanan);
// Rute untuk mengambil riwayat pemesanan
router.get('/riwayat', authenticate, authenticateToken, getRiwayatPemesanan);

module.exports = router;

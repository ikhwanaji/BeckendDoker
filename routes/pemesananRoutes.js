const express = require('express');
const router = express.Router();
const { getRiwayatPemesanan } = require('../controllers/pemesananController');
const { createPemesanan, updatePaymentStatus, getPemesananById, getAllPemesanan, updateShippingStatus } = require('../controllers/pemesananController');
// Middleware autentikasi
const { authenticate, authenticateToken, isAdmin } = require('../middleware/authMiddleware');

router.post('/create', authenticate, authenticateToken, createPemesanan);
router.post('/update-payment-status', authenticate, authenticateToken, updatePaymentStatus);

// Rute untuk mengambil riwayat pemesanan
router.get('/riwayat', authenticate, authenticateToken, getRiwayatPemesanan);

router.get('/:orderId', getPemesananById);

router.get('/admin/all', authenticate, authenticateToken, isAdmin, getAllPemesanan);

// Route untuk admin - update status pengiriman
router.patch('/admin/shipping/:orderId', authenticate, authenticateToken, isAdmin, updateShippingStatus);
module.exports = router;

// routes/pemesananRoutes.js
const express = require('express');
const router = express.Router();
const { createOrder, updatePaymentStatus, getRiwayatPemesanan,getPemesananById, getAllPemesananPaket , updateShippingStatusPaket } = require('../controllers/OrderPaketController');
const { authenticate, authenticateToken,isAdmin } = require('../middleware/authMiddleware');

// Rute untuk membuat pemesanan (membutuhkan autentikasi)

router.post('/create-order', authenticate, authenticateToken, createOrder);
router.post('/update-payment-paket-status', authenticate, authenticateToken, updatePaymentStatus);

// Rute untuk mengambil riwayat pemesanan
router.get('/riwayat-paket', authenticate, authenticateToken, getRiwayatPemesanan);
router.get('/:orderId', getPemesananById);
router.get('/admin/all', authenticate, authenticateToken, isAdmin, getAllPemesananPaket);

// Route untuk admin - update status pengiriman
router.patch('/admin/shipping/:orderId', authenticate, authenticateToken, isAdmin, updateShippingStatusPaket);

module.exports = router;

const express = require('express');
const router = express.Router();
// const produkController = require('../controllers/produkController');
const { validateProdukUpload } = require('../middleware/uploadMiddleware');
const { tambahProduk,semuaProduk,produkById,updateProduk,hapusProduk, } = require('../controllers/produkController');
const { getProdukImage } = require('../controllers/imageController');

// Rute Produk
router.post('/',validateProdukUpload, tambahProduk);
router.get('/', semuaProduk );
router.get('/:id', produkById );
router.put('/:id',validateProdukUpload, updateProduk);
router.delete('/:id', hapusProduk);
router.get('/images/:filename', getProdukImage);


module.exports = router;
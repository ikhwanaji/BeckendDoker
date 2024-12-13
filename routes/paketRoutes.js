const express = require('express');
const { getAllPaket, addPaket,getPaketById, updatePaket, deletePaket } = require('../controllers/paketController');
const { validatePaketUpload } = require('../middleware/uploadMiddleware');
const { getPaketImage } = require('../controllers/imageController');

const router = express.Router();

// Mendapatkan semua paket
router.get('/paket', getAllPaket);
router.get('/paket/:paketId', getPaketById);

// Menambahkan paket baru
router.post('/paket', validatePaketUpload,addPaket);

// Mengupdate paket
router.put('/paket/:paketId', updatePaket);

// Menghapus paket
router.delete('/paket/:paketId', deletePaket);

router.get('/paket/images/:filename', getPaketImage);

module.exports = router;
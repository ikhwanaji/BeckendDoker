const express = require('express');
const router = express.Router();
const kategoriController = require('../controllers/kategoriController');

router.get('/', kategoriController.getAllKategori);
router.get('/:kategoriId', kategoriController.getKategoriById);
router.post('/', kategoriController.createKategori);
router.put('/:kategoriId', kategoriController.updateKategori);
router.delete('/:kategoriId', kategoriController.deleteKategori);

module.exports = router;
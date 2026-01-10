const express = require('express');
const router = express.Router();

const { getAllPenyakit, getPenyakitById, createPenyakit, updatePenyakit, deletePenyakit } = require('../controllers/PenyakitController.js');
const {  validateArticleImageUpload } = require('../middleware/uploadMiddleware.js');
const { getArtikelImage } = require('../controllers/imageController.js');

router.post('/tambah-penyakit', validateArticleImageUpload, createPenyakit);
router.get('/getallPenyakit', getAllPenyakit);
router.get('/getById/:PenyakitId', getPenyakitById);
router.put('/put/:PenyakitId', validateArticleImageUpload, updatePenyakit);
router.delete('/delete-penyakit/:PenyakitId', deletePenyakit);
router.get('/images/:filename', getArtikelImage);

module.exports = router;

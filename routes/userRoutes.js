const express = require('express');
const { getUsers, addUser, deleteUser } = require('../controllers/userController');

const router = express.Router();

// Rute untuk mendapatkan semua pengguna
router.get('/users', getUsers);

// Rute untuk menambahkan pengguna baru
router.post('/users', addUser);
router.put('/users/:id', deleteUser );

module.exports = router;

const express = require('express');
const router = express.Router();
const { getAllShippingMethods,getShippingMethodById,createShippingMethod,updateShippingMethod,deleteShippingMethod,toggleShippingMethodStatus } = require('../controllers/shippingMethodController');
const { authenticate } = require(`../middleware/authMiddleware`);

// Rute untuk metode pengiriman
router.get('/', authenticate,  getAllShippingMethods);
router.get('/:id',authenticate, getShippingMethodById);
router.post('/',authenticate,  createShippingMethod);
router.put('/:id',authenticate, updateShippingMethod);
router.delete('/:id',authenticate, deleteShippingMethod);
router.patch('/:id/status',authenticate, toggleShippingMethodStatus);

module.exports = router;
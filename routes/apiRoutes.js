const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../controllers/contactController');
const { getAllProducts } = require('../controllers/productController');
const { processAiChat } = require('../controllers/aiController');

// Rutas de API
router.post('/contact', sendContactMessage);
router.get('/products', getAllProducts);
router.post('/ai/chat', processAiChat);

module.exports = router;
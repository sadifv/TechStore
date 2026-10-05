const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../controllers/contactController');
const { getAllProducts } = require('../controllers/productController');
const { processAiChat } = require('../controllers/aiController');
const { loginUser } = require('../controllers/authController');

// Rutas de API
router.post('/contact', sendContactMessage);
router.get('/products', getAllProducts);
router.post('/ai/chat', processAiChat);
router.post('/login', loginUser);

module.exports = router;
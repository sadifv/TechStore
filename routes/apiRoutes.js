const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../controllers/contactController');
const { getAllProducts } = require('../controllers/productController');
const { processAiChat } = require('../controllers/aiController');
const { subscribeNewsletter } = require('../controllers/newsletterController');
const { registerUser, logoutUser, getMe } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Rutas Públicas de la API
router.post('/contact', sendContactMessage);
router.post('/newsletter', subscribeNewsletter);
router.get('/products', getAllProducts);
router.post('/ai/chat', processAiChat);

// Rutas de Autenticación de Usuario
router.post('/auth/register', registerUser);
router.post('/auth/logout', logoutUser);
router.get('/auth/me', requireAuth, getMe);

module.exports = router;
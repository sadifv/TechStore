const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../controllers/contactController');
const { getAllProducts } = require('../controllers/productController');
const { processAiChat, getChatHistory, clearChatHistory } = require('../controllers/aiController');
const { subscribeNewsletter } = require('../controllers/newsletterController');
const { registerUser, logoutUser, getMe } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { aiLimiter, aiSlowDown, registerLimiter } = require('../middleware/rateLimiter');

// Rutas Públicas de la API
router.post('/contact', sendContactMessage);
router.post('/newsletter', subscribeNewsletter);
router.get('/products', getAllProducts);

// Rutas de la IA (requieren login)
router.post('/ai/chat', requireAuth, aiSlowDown, aiLimiter, processAiChat);
router.get('/ai/history', requireAuth, getChatHistory);
router.delete('/ai/history', requireAuth, clearChatHistory);

// Rutas de Autenticación de Usuario
router.post('/auth/register', registerLimiter, registerUser); // <-- PROTEGIDO
router.post('/auth/logout', logoutUser);
router.get('/auth/me', requireAuth, getMe);

module.exports = router;
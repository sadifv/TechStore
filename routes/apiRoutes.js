const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../controllers/contactController');
const { getAllProducts } = require('../controllers/productController');
const { processAiChat, getChatHistory, clearChatHistory } = require('../controllers/aiController');
const { subscribeNewsletter } = require('../controllers/newsletterController');
const { registerUser, logoutUser, getMe } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { aiLimiter, aiSlowDown, registerLimiter } = require('../middleware/rateLimiter');
const { 
    validate, 
    contactValidation, 
    newsletterValidation, 
    authValidation 
} = require('../middleware/validationMiddleware'); // 👈 Importamos validación

// Rutas Públicas de la API (Protegidas con validación de entrada)
router.post('/contact', validate(contactValidation), sendContactMessage);
router.post('/newsletter', validate(newsletterValidation), subscribeNewsletter);
router.get('/products', getAllProducts);

// Rutas de la IA (requieren login)
router.post('/ai/chat', requireAuth, aiSlowDown, aiLimiter, processAiChat);
router.get('/ai/history', requireAuth, getChatHistory);
router.delete('/ai/history', requireAuth, clearChatHistory);

// Rutas de Autenticación de Usuario (Protegidas con rate limit + validación)
router.post('/auth/register', registerLimiter, validate(authValidation.register), registerUser);
router.post('/auth/logout', logoutUser);
router.get('/auth/me', requireAuth, getMe);

module.exports = router;
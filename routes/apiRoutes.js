const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../controllers/contactController');
const { getProducts, getProductById } = require('../controllers/productController');
const { processAiChat, getChatHistory, clearChatHistory } = require('../controllers/aiController');
const {
    subscribeNewsletter,
    unsubscribeNewsletter,
    unsubscribeCampaignMarketing
} = require('../controllers/newsletterController');
const {
    getMembershipStatus,
    startMembershipCheckout,
    confirmMockMembership,
    cancelMembership,
    unsubscribeVipMarketing
} = require('../controllers/membershipController');
const {
    registerUser,
    logoutUser,
    getMe,
    forgotPassword,
    resetPassword
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { aiLimiter, aiSlowDown, registerLimiter, sensitiveLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');

// ==========================================
// RUTAS PÚBLICAS
// ==========================================

router.post('/contact', sensitiveLimiter, validate, sendContactMessage);
router.post('/newsletter', sensitiveLimiter, validate, subscribeNewsletter);
router.get('/newsletter/unsubscribe/:token', unsubscribeNewsletter);
router.get('/marketing/unsubscribe', unsubscribeCampaignMarketing);
router.get('/membership', requireAuth, getMembershipStatus);
router.post('/membership/checkout', requireAuth, sensitiveLimiter, startMembershipCheckout);
router.post('/membership/mock-confirm', requireAuth, sensitiveLimiter, confirmMockMembership);
router.post('/membership/cancel', requireAuth, sensitiveLimiter, cancelMembership);
router.get('/membership/unsubscribe/:token', unsubscribeVipMarketing);
router.get('/products', getProducts);
router.get('/products/:id', getProductById); 

// ==========================================
// RUTAS DE LA IA
// ==========================================

router.post('/ai/chat', requireAuth, aiSlowDown, aiLimiter, processAiChat);
router.get('/ai/history', requireAuth, getChatHistory);
router.delete('/ai/history', requireAuth, clearChatHistory);

// ==========================================
// AUTENTICACIÓN
// ==========================================

router.post('/auth/register', registerLimiter, validate, registerUser);
router.post('/auth/logout', logoutUser);
router.get('/auth/me', requireAuth, getMe);

// ==========================================
// RECUPERACIÓN DE CONTRASEÑA
// ==========================================

router.post('/auth/forgot-password', sensitiveLimiter, validate, forgotPassword);
router.post('/auth/reset-password/:token', sensitiveLimiter, validate, resetPassword);

module.exports = router;
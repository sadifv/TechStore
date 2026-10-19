const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../controllers/contactController');
const { getProducts, getProductById } = require('../controllers/productController');
const { processAiChat, getChatHistory, clearChatHistory } = require('../controllers/aiController');
const {
  subscribeNewsletter,
  unsubscribeNewsletter,
  unsubscribeCampaignMarketing,
} = require('../controllers/newsletterController');
const {
  getMembershipStatus,
  startMembershipCheckout,
  confirmMockMembership,
  confirmStripeMembership,
  cancelMembership,
  createMembershipPortalSession,
  unsubscribeVipMarketing,
} = require('../controllers/membershipController');
const {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  aiLimiter,
  aiSlowDown,
  registerLimiter,
  sensitiveLimiter,
  loginLimiter,
} = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/authMiddleware');
const {
  getAdminDashboard,
  getAdminOrders,
  getAdminOrderDetail,
  getPackingSlip,
  getAdminUsers,
} = require('../controllers/adminController');
const { getAdminMarketing } = require('../controllers/marketingController');
const { recordHeartbeat } = require('../controllers/presenceController');

// ==========================================
// RUTAS PÚBLICAS
// ==========================================

router.post('/contact', sensitiveLimiter, validate, sendContactMessage);
router.post('/newsletter', sensitiveLimiter, validate, subscribeNewsletter);
router
  .route('/newsletter/unsubscribe/:token')
  .get(unsubscribeNewsletter)
  .post(unsubscribeNewsletter);
router
  .route('/marketing/unsubscribe')
  .get(unsubscribeCampaignMarketing)
  .post(unsubscribeCampaignMarketing);
router.get('/membership', requireAuth, getMembershipStatus);
router.post('/presence/heartbeat', requireAuth, recordHeartbeat);
router.post('/membership/checkout', requireAuth, sensitiveLimiter, startMembershipCheckout);
router.post('/membership/mock-confirm', requireAuth, sensitiveLimiter, confirmMockMembership);
router.get('/membership/confirm', requireAuth, confirmStripeMembership);
router.post('/membership/cancel', requireAuth, sensitiveLimiter, cancelMembership);
router.post('/membership/portal', requireAuth, sensitiveLimiter, createMembershipPortalSession);
router.get('/membership/unsubscribe/:token', unsubscribeVipMarketing);
router.post('/membership/unsubscribe/:token', unsubscribeVipMarketing);
router.get('/products', getProducts);
router.get('/products/:id', getProductById);

// APIs JSON del panel administrativo React.
router.get('/admin/dashboard', requireAdmin, getAdminDashboard);
router.get('/admin/marketing', requireAdmin, getAdminMarketing);
router.get('/admin/orders', requireAdmin, getAdminOrders);
router.get('/admin/orders/:id/packing-slip', requireAdmin, getPackingSlip);
router.get('/admin/orders/:id', requireAdmin, getAdminOrderDetail);
router.get('/admin/users', requireAdmin, getAdminUsers);

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
router.post('/auth/login', loginLimiter, validate, loginUser);
router.post('/auth/logout', logoutUser);
router.get('/auth/me', requireAuth, getMe);

// ==========================================
// RECUPERACIÓN DE CONTRASEÑA
// ==========================================

router.post('/auth/forgot-password', sensitiveLimiter, validate, forgotPassword);
router.post('/auth/reset-password/:token', sensitiveLimiter, validate, resetPassword);

module.exports = router;

const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../controllers/contactController');
const {
  getProducts,
  getProductById,
  getHomeProducts,
} = require('../controllers/productController');
const { processAiChat, getChatHistory, clearChatHistory } = require('../controllers/aiController');
const {
  subscribeNewsletter,
  unsubscribeNewsletter,
  unsubscribeCampaignMarketing,
} = require('../controllers/newsletterController');
const {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  forgotPassword,
  resetPassword,
  beginAdminMfaEnrollment,
  confirmAdminMfaEnrollment,
  verifyAdminMfa,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  aiLimiter,
  aiSlowDown,
  registerLimiter,
  contactLimiter,
  newsletterLimiter,
  passwordRecoveryLimiter,
  passwordResetLimiter,
  loginLimiter,
  adminMfaLimiter,
} = require('../middleware/rateLimiter');
const { requireAdminMfaPreauth } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { requireAdmin, requireOwner } = require('../middleware/authMiddleware');
const {
  getAdminDashboard,
  getAdminOrders,
  getAdminOrderDetail,
  getPackingSlip,
  getAdminUsers,
} = require('../controllers/adminController');
const { getWhatsappPhone } = require('../config/whatsapp');
router.get('/store/config', (req, res) => {
  const phone = getWhatsappPhone();
  res.json({ success: true, whatsappPhone: phone, whatsappUrl: `https://wa.me/${phone}` });
});
const { getAdminMarketing } = require('../controllers/marketingController');
const { recordHeartbeat } = require('../controllers/presenceController');

// ==========================================
// RUTAS PÚBLICAS
// ==========================================

router.post('/contact', contactLimiter, validate, sendContactMessage);
router.post('/newsletter', newsletterLimiter, validate, subscribeNewsletter);
router
  .route('/newsletter/unsubscribe/:token')
  .get(unsubscribeNewsletter)
  .post(unsubscribeNewsletter);
router
  .route('/marketing/unsubscribe')
  .get(unsubscribeCampaignMarketing)
  .post(unsubscribeCampaignMarketing);
router.post('/presence/heartbeat', requireAuth, recordHeartbeat);
router.get('/products', getProducts);
router.get('/products/home', getHomeProducts);
router.get('/products/:id', getProductById);

// APIs JSON del panel administrativo React.
router.get('/admin/dashboard', requireAdmin, getAdminDashboard);
router.get('/admin/marketing', requireAdmin, getAdminMarketing);
router.get('/admin/orders', requireAdmin, getAdminOrders);
router.get('/admin/orders/:id/packing-slip', requireAdmin, getPackingSlip);
router.get('/admin/orders/:id', requireAdmin, getAdminOrderDetail);
router.use('/admin/orders', require('./orderAdminRoutes'));
router.get('/admin/users', requireAdmin, getAdminUsers);
router.patch(
  '/admin/users/:id/role',
  requireOwner,
  require('../controllers/userManagementController').updateUserRole,
);

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
router.post(
  '/auth/admin/mfa/enroll',
  adminMfaLimiter,
  requireAdminMfaPreauth,
  beginAdminMfaEnrollment,
);
router.post(
  '/auth/admin/mfa/confirm',
  adminMfaLimiter,
  requireAdminMfaPreauth,
  confirmAdminMfaEnrollment,
);
router.post('/auth/admin/mfa/verify', adminMfaLimiter, requireAdminMfaPreauth, verifyAdminMfa);
router.post('/auth/logout', logoutUser);
router.get('/auth/me', requireAuth, getMe);

// ==========================================
// RECUPERACIÓN DE CONTRASEÑA
// ==========================================

router.post('/auth/forgot-password', passwordRecoveryLimiter, validate, forgotPassword);
router.post('/auth/reset-password/:token', passwordResetLimiter, validate, resetPassword);

module.exports = router;

const express = require('express');
const router = express.Router();
router.use(require('./reviewRoutes'));
router.use('/addresses', require('./addressRoutes'));
router.use('/favorites', require('./favoriteRoutes'));
router.use('/restock-alerts', require('./restockAlertRoutes'));
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
const appearance = require('../controllers/appearanceController');
const collections = require('../controllers/storeCollectionsController');
const content = require('../controllers/storeContentController');
router.get('/store/content', content.getContent);
const categories = require('../controllers/storeCategoriesController');
router.get('/store/categories', categories.getCategories);
router.get('/admin/categories', requireAdmin, categories.getCategories);
router.patch(
  '/admin/categories',
  requireAdmin,
  require('../middleware/rateLimiter').adminLimiter,
  categories.updateCategories,
);
router.patch(
  '/admin/collections/definition',
  requireAdmin,
  require('../middleware/rateLimiter').adminLimiter,
  collections.updateDefinition,
);
router.get('/admin/content', requireAdmin, content.getContent);
router.patch(
  '/admin/content',
  requireAdmin,
  require('../middleware/rateLimiter').adminLimiter,
  content.updateContent,
);
router.get('/store/collections', collections.getCollections);
router.get('/admin/collections', requireAdmin, collections.getSelection);
router.patch(
  '/admin/collections',
  requireAdmin,
  require('../middleware/rateLimiter').adminLimiter,
  collections.updateSelection,
);
router.get('/store/appearance', appearance.getAppearance);
router.patch(
  '/admin/appearance',
  requireOwner,
  require('../middleware/rateLimiter').adminLimiter,
  appearance.updateAppearance,
);
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
router.get('/admin/audit', requireOwner, require('../services/adminAudit').getAudit);
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

// Administrative writes must be reachable through Netlify's /api proxy.
router.use(
  '/admin',
  require('../middleware/rateLimiter').adminLimiter,
  require('./adminMutationRoutes'),
);

// ==========================================
// RUTAS DE LA IA
// ==========================================

router.post('/ai/chat', requireAuth, aiSlowDown, aiLimiter, processAiChat);
router.post(
  '/ai/recommendations',
  requireAuth,
  aiSlowDown,
  aiLimiter,
  require('../controllers/guidedShoppingController').getGuidedRecommendations,
);
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
const account = require('../controllers/accountSecurityController');
const accountLimit = require('../middleware/rateLimiter').accountSecurityLimiter;
router.patch('/auth/account/name', requireAuth, accountLimit, account.changeName);
router.post('/auth/account/password', requireAuth, accountLimit, account.changePassword);
router.post('/auth/account/email', requireAuth, accountLimit, account.requestEmailChange);
router.post('/auth/account/email/confirm', requireAuth, accountLimit, account.confirmEmailChange);

// ==========================================
// RECUPERACIÓN DE CONTRASEÑA
// ==========================================

router.post('/auth/forgot-password', passwordRecoveryLimiter, validate, forgotPassword);
router.post('/auth/reset-password/:token', passwordResetLimiter, validate, resetPassword);

module.exports = router;

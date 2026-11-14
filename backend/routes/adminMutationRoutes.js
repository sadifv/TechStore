const { auditedHandler } = require('../services/adminAudit');
const express = require('express');
const router = express.Router();

const { requireAdmin } = require('../middleware/authMiddleware');
const adminCatalog = require('../controllers/adminCatalogController');
router.get('/products', requireAdmin, adminCatalog.getProducts);
router.get('/messages', requireAdmin, adminCatalog.getMessages);
router.patch('/products/:id/restore', requireAdmin, adminCatalog.restoreProduct);
const {
  createProduct,
  updateProduct,
  deleteProduct,
  activateFlashSale,
  deactivateFlashSale,
} = require('../controllers/productController');
const { updateOrderStatus } = require('../controllers/orderController');
const { uploadSingleProductImage } = require('../middleware/uploadMiddleware');
const { validate } = require('../middleware/validate');

const Contact = require('../models/Contact');
const Newsletter = require('../models/Newsletter');
const logger = require('../config/logger');
const {
  createAdminCoupon,
  updateAdminCouponStatus,
  sendAdminCampaign,
  sendAdminCampaignTest,
} = require('../controllers/marketingController');

// DASHBOARD
// ==========================================
router.post('/coupons', requireAdmin, createAdminCoupon);
router.patch('/coupons/:id/status', requireAdmin, updateAdminCouponStatus);
router.post('/campaigns', requireAdmin, sendAdminCampaign);
router.post('/campaigns/test', requireAdmin, sendAdminCampaignTest);

// ==========================================
// GESTIÓN DE ÓRDENES
// ==========================================
router.put('/orders/:id/status', requireAdmin, updateOrderStatus);

// ==========================================
// GESTIÓN DE USUARIOS
// ==========================================

// ==========================================
// PRODUCTOS Y OFERTAS FLASH
// ==========================================
router.post('/products', requireAdmin, uploadSingleProductImage, validate, createProduct);
router.put('/products/:id', requireAdmin, uploadSingleProductImage, validate, updateProduct);
router.delete('/products/:id', requireAdmin, deleteProduct);

router.post('/products/:id/flash-sale', requireAdmin, activateFlashSale);
router.delete('/products/:id/flash-sale', requireAdmin, deactivateFlashSale);

// ==========================================
// ELIMINACIÓN DE RECURSOS
// ==========================================
router.delete(
  '/messages/:id',
  requireAdmin,
  auditedHandler(
    async (req, res, next) => {
      try {
        const deleted = await Contact.findByIdAndDelete(req.params.id);
        if (!deleted)
          return res.status(404).json({ success: false, error: 'Recurso no encontrado.' });
        return res.json({ success: true });
      } catch (error) {
        return next(error);
      }
    },
    'message.deleted',
    (body, req) => ({ _id: req.params.id }),
  ),
);

router.delete(
  '/subscribers/:id',
  requireAdmin,
  auditedHandler(
    async (req, res, next) => {
      try {
        const deleted = await Newsletter.findByIdAndDelete(req.params.id);
        if (!deleted)
          return res.status(404).json({ success: false, error: 'Recurso no encontrado.' });
        return res.json({ success: true });
      } catch (error) {
        return next(error);
      }
    },
    'subscriber.deleted',
    (body, req) => ({ _id: req.params.id }),
  ),
);

router.delete(
  '/users/:id',
  requireAdmin,
  require('../controllers/userManagementController').deleteUser,
);

module.exports = router;

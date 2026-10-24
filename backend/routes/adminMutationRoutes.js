const express = require('express');
const router = express.Router();


const { requireAdmin } = require('../middleware/authMiddleware');
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
} = require('../controllers/marketingController');

// DASHBOARD
// ==========================================
router.post('/coupons', requireAdmin, createAdminCoupon);
router.patch('/coupons/:id/status', requireAdmin, updateAdminCouponStatus);
router.post('/campaigns', requireAdmin, sendAdminCampaign);

// ==========================================
// GESTIÓN DE ÓRDENES
// ==========================================
router.put('/orders/:id/status', requireAdmin, updateOrderStatus);

// ==========================================
// GESTIÓN DE USUARIOS
// ==========================================

// ==========================================
// PRODUCTOS Y OFERTAS FLASH
// ✅ FIX: `validate` SIN paréntesis
// ==========================================
router.post('/products', requireAdmin, uploadSingleProductImage, validate, createProduct);
router.put('/products/:id', requireAdmin, uploadSingleProductImage, validate, updateProduct);
router.delete('/products/:id', requireAdmin, deleteProduct);

router.post('/products/:id/flash-sale', requireAdmin, activateFlashSale);
router.delete('/products/:id/flash-sale', requireAdmin, deactivateFlashSale);

// ==========================================
// ELIMINACIÓN DE RECURSOS
// ==========================================
router.delete('/messages/:id', requireAdmin, async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Mensaje eliminado con éxito.' });
  } catch (error) {
    logger.error(`Error al eliminar mensaje: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, error: 'Error al eliminar el mensaje.' });
  }
});

router.delete('/subscribers/:id', requireAdmin, async (req, res) => {
  try {
    await Newsletter.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Suscriptor eliminado con éxito.' });
  } catch (error) {
    logger.error(`Error al eliminar suscriptor: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, error: 'Error al eliminar el suscriptor.' });
  }
});

router.delete(
  '/users/:id',
  requireAdmin,
  require('../controllers/userManagementController').deleteUser,
);

module.exports = router;

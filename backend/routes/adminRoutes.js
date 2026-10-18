const express = require('express');
const router = express.Router();
const { redirectToFrontend } = require('../config/frontendUrl');

const { requireAdmin } = require('../middleware/authMiddleware');
const {
    createProduct,
    updateProduct,
    deleteProduct,
    activateFlashSale,
    deactivateFlashSale
} = require('../controllers/productController');
const { updateOrderStatus } = require('../controllers/orderController');
const { uploadSingleProductImage } = require('../middleware/uploadMiddleware');
const { validate } = require('../middleware/validate');

const Contact = require('../models/Contact');
const Newsletter = require('../models/Newsletter');
const User = require('../models/User');
const Presence = require('../models/Presence');
const logger = require('../config/logger');
const {
    createAdminCoupon,
    updateAdminCouponStatus,
    sendAdminCampaign
} = require('../controllers/marketingController');

// DASHBOARD
// ==========================================
router.get('/', redirectToFrontend);
router.get('/dashboard', redirectToFrontend);
router.get('/marketing', redirectToFrontend);
router.post('/coupons', requireAdmin, createAdminCoupon);
router.patch('/coupons/:id/status', requireAdmin, updateAdminCouponStatus);
router.post('/campaigns', requireAdmin, sendAdminCampaign);

// ==========================================
// GESTIÓN DE ÓRDENES
// ==========================================
router.get('/orders', redirectToFrontend);
router.get('/orders/:id/packing-slip', redirectToFrontend);
router.get('/orders/:id', redirectToFrontend);
router.put('/orders/:id/status', requireAdmin, updateOrderStatus);

// ==========================================
// GESTIÓN DE USUARIOS
// ==========================================
router.get('/users', redirectToFrontend);

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

router.delete('/users/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (req.session && req.session.user && req.session.user.id === id) {
            return res.status(400).json({ success: false, error: 'No puedes eliminar tu propia cuenta de administrador.' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
        }

        await User.findByIdAndDelete(id);
        await Presence.deleteOne({ user: id });
        res.json({ success: true, message: 'Usuario eliminado correctamente.' });
    } catch (error) {
        logger.error(`Error al eliminar usuario: ${error.message}`, { stack: error.stack });
        res.status(500).json({ success: false, error: 'Error al eliminar el usuario.' });
    }
});

module.exports = router;

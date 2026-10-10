const express = require('express');
const router = express.Router();

const { requireAdmin } = require('../middleware/authMiddleware');
const { logoutUser } = require('../controllers/authController');
const {
    createProduct,
    updateProduct,
    deleteProduct,
    activateFlashSale,
    deactivateFlashSale
} = require('../controllers/productController');
const { updateOrderStatus } = require('../controllers/orderController');
const { 
    getAdminOrders, 
    getAdminOrderDetail, 
    getPackingSlip 
} = require('../controllers/adminController');
const { uploadSingleProductImage } = require('../middleware/uploadMiddleware');
const { validate, productValidation } = require('../middleware/validationMiddleware');

const Product = require('../models/Product');
const Contact = require('../models/Contact');
const Newsletter = require('../models/Newsletter');
const User = require('../models/User');
const Order = require('../models/Order');
const logger = require('../config/logger');

// Cerrar sesión
router.get('/logout', logoutUser);

// Dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
    try {
        const productsCount = await Product.countDocuments();
        const messagesCount = await Contact.countDocuments();
        const subscribersCount = await Newsletter.countDocuments();
        const usersCount = await User.countDocuments();
        const ordersCount = await Order.countDocuments();

        const products = await Product.find().sort({ createdAt: -1 }).lean();
        const recentMessages = await Contact.find().sort({ createdAt: -1 }).limit(5).lean();
        const subscribers = await Newsletter.find().sort({ createdAt: -1 }).lean();
        const users = await User.find({}, '-password').sort({ createdAt: -1 }).lean();
        const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 }).lean();

        res.render('admin/dashboard', {
            title: 'TechStore - Panel de Administración',
            stats: {
                productsCount,
                messagesCount,
                subscribersCount,
                usersCount,
                ordersCount
            },
            products,
            messages: recentMessages,
            subscribers,
            users,
            orders
        });
    } catch (error) {
        logger.error(`Error al cargar dashboard: ${error.message}`, { stack: error.stack });
        res.status(500).send('Error del servidor al cargar el panel.');
    }
});

// ==========================================
// GESTIÓN DE ÓRDENES Y PACKING SLIP
// ==========================================

router.get('/orders', requireAdmin, getAdminOrders);
router.get('/orders/:id', requireAdmin, getAdminOrderDetail);
router.get('/orders/:id/packing-slip', requireAdmin, getPackingSlip);
router.put('/orders/:id/status', requireAdmin, updateOrderStatus);

// ==========================================
// PRODUCTOS Y OFERTAS FLASH
// ==========================================

router.post('/products', requireAdmin, uploadSingleProductImage, validate(productValidation), createProduct);
router.put('/products/:id', requireAdmin, uploadSingleProductImage, validate(productValidation), updateProduct);
router.delete('/products/:id', requireAdmin, deleteProduct);

router.post('/products/:id/flash-sale', requireAdmin, activateFlashSale);
router.delete('/products/:id/flash-sale', requireAdmin, deactivateFlashSale);

// ==========================================
// ELIMINACIÓN DE RECURSOS (ADMIN)
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
        res.json({ success: true, message: 'Usuario eliminado correctamente.' });
    } catch (error) {
        logger.error(`Error al eliminar usuario: ${error.message}`, { stack: error.stack });
        res.status(500).json({ success: false, error: 'Error al eliminar el usuario.' });
    }
});

module.exports = router;
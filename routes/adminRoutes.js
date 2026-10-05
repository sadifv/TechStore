const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const { loginUser, logoutUser } = require('../controllers/authController');
const { createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const Product = require('../models/Product');
const Contact = require('../models/Contact');
const Newsletter = require('../models/Newsletter');

// Autenticación de Administrador
router.post('/login', loginUser);
router.get('/logout', logoutUser);

// Vista del Dashboard (Protegida)
router.get('/dashboard', requireAdmin, async (req, res) => {
    try {
        // 1. Obtener conteos para las métricas
        const productsCount = await Product.countDocuments();
        const messagesCount = await Contact.countDocuments();
        const subscribersCount = await Newsletter.countDocuments();

        // 2. Obtener datos para las tablas
        const products = await Product.find().sort({ createdAt: -1 }).lean();
        const recentMessages = await Contact.find().sort({ createdAt: -1 }).limit(5).lean();
        const subscribers = await Newsletter.find().sort({ createdAt: -1 }).lean();

        res.render('admin/dashboard', {
            title: 'TechStore - Panel de Administración',
            stats: {
                productsCount,
                messagesCount,
                subscribersCount
            },
            products,
            messages: recentMessages,
            subscribers
        });
    } catch (error) {
        console.error('Error al cargar dashboard:', error);
        res.status(500).send('Error del servidor al cargar el panel.');
    }
});

// Rutas API CRUD para Administración de Productos
router.post('/products', requireAdmin, createProduct);
router.put('/products/:id', requireAdmin, updateProduct);
router.delete('/products/:id', requireAdmin, deleteProduct);

module.exports = router;
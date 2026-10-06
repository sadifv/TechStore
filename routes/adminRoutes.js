const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const { loginUser, logoutUser } = require('../controllers/authController');
const { createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const Product = require('../models/Product');
const Contact = require('../models/Contact');
const Newsletter = require('../models/Newsletter');
const User = require('../models/User');

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
        const usersCount = await User.countDocuments();

        // 2. Obtener datos para las tablas
        const products = await Product.find().sort({ createdAt: -1 }).lean();
        const recentMessages = await Contact.find().sort({ createdAt: -1 }).limit(5).lean();
        const subscribers = await Newsletter.find().sort({ createdAt: -1 }).lean();
        const users = await User.find({}, '-password').sort({ createdAt: -1 }).lean();

        res.render('admin/dashboard', {
            title: 'TechStore - Panel de Administración',
            stats: {
                productsCount,
                messagesCount,
                subscribersCount,
                usersCount
            },
            products,
            messages: recentMessages,
            subscribers,
            users
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

// Rutas API CRUD para Eliminación de Mensajes y Suscriptores
router.delete('/messages/:id', requireAdmin, async (req, res) => {
    try {
        await Contact.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Mensaje eliminado con éxito.' });
    } catch (error) {
        console.error('Error al eliminar mensaje:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar el mensaje.' });
    }
});

router.delete('/subscribers/:id', requireAdmin, async (req, res) => {
    try {
        await Newsletter.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Suscriptor eliminado con éxito.' });
    } catch (error) {
        console.error('Error al eliminar suscriptor:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar el suscriptor.' });
    }
});

// Ruta API CRUD para Eliminación de Usuarios
router.delete('/users/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Evitar que el administrador se elimine a sí mismo
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
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar el usuario.' });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const { loginUser } = require('../controllers/authController');
const Product = require('../models/Product');
const Contact = require('../models/Contact');

router.post('/login', loginUser);

// Vista del Dashboard (Protegida)
router.get('/dashboard', requireAdmin, async (req, res) => {
    try {
        const productsCount = await Product.countDocuments();
        const messagesCount = await Contact.countDocuments();
        const recentMessages = await Contact.find().sort({ createdAt: -1 }).limit(5).lean();

        res.render('admin/dashboard', {
            title: 'TechStore - Panel de Administración',
            stats: {
                productsCount,
                messagesCount
            },
            messages: recentMessages
        });
    } catch (error) {
        console.error('Error al cargar dashboard:', error);
        res.status(500).send('Error del servidor al cargar el panel.');
    }
});

module.exports = router;
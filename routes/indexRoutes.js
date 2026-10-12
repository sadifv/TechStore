const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { getProductDetailPage } = require('../controllers/productController');
const { requireAuth } = require('../middleware/authMiddleware');
const { loginUser, registerUser } = require('../controllers/authController');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const logger = require('../config/logger');

router.get('/', async (req, res) => {
    try {
        const now = new Date();
        const [featuredProducts, flashSaleProduct] = await Promise.all([
            Product.find().sort({ createdAt: -1 }).limit(6).lean(),
            Product.findOne({ flashSale: true, flashSaleEndsAt: { $gt: now } })
                .sort({ flashSaleEndsAt: 1 })
                .lean()
        ]);

        res.render('index', {
            title: 'TechStore - Inicio',
            products: featuredProducts,
            flashSale: flashSaleProduct || null
        });
    } catch (error) {
        logger.error(`Error al cargar la página principal: ${error.message}`, { stack: error.stack });
        res.render('index', {
            title: 'TechStore - Inicio',
            products: [],
            flashSale: null
        });
    }
});

router.get('/catalogo', (req, res) => {
    res.render('components/catalog', {
        title: 'Catálogo de Productos - TechStore'
    });
});

router.get('/producto/:id', getProductDetailPage);

router.get('/legal', (req, res) => {
    res.render('legal', {
        title: 'Información Legal | TechStore'
    });
});

router.get('/login', (req, res) => {
    res.render('login', {
        title: 'TechStore - Iniciar Sesión'
    });
});

router.post('/login', loginLimiter, loginUser);

router.get('/register', (req, res) => {
    res.render('register', {
        title: 'TechStore - Crear Cuenta'
    });
});

router.post('/register', registerLimiter, registerUser);

router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', {
        title: 'TechStore - Recuperar Contraseña'
    });
});

router.get('/reset-password/:token', (req, res) => {
    res.render('reset-password', {
        title: 'TechStore - Nueva Contraseña',
        token: req.params.token
    });
});

router.get('/profile', requireAuth, (req, res) => {
    res.render('profile', {
        title: 'Mi Perfil | TechStore',
        user: req.session.user || req.user
    });
});

module.exports = router;
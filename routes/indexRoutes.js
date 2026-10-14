const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const { getProductDetailPage } = require('../controllers/productController');
const { requireAuth } = require('../middleware/authMiddleware');
const { loginUser, registerUser } = require('../controllers/authController');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { getPaymentMode, getMembershipPrice } = require('../services/membershipBilling');
const { getMembershipConfig } = require('../config/membershipConfig');
const { getMockCheckoutPage } = require('../controllers/membershipController');

router.get('/', async (req, res, next) => {
    try {
        const now = new Date();
        const [featuredProducts, flashSaleProduct] = await Promise.all([
            Product.find().sort({ createdAt: -1 }).limit(8).lean(),
            Product.findOne({ flashSale: true, flashSaleEndsAt: { $gt: now } })
                .sort({ flashSaleEndsAt: 1 })
                .lean()
        ]);

        const products = await Promise.all(featuredProducts.map(async (product) => {
            const reservedStock = await Reservation.getReservedStock(product._id);
            return {
                ...product,
                availableStock: Math.max(0, product.stock - reservedStock)
            };
        }));

        res.render('index', {
            title: 'TechStore - Inicio',
            products,
            flashSale: flashSaleProduct || null,
            monthlyPrice: getMembershipPrice()
        });
    } catch (error) {
        next(error);
    }
});

router.get('/catalogo', (req, res) => {
    res.render('components/catalog', {
        title: 'Catálogo de Productos - TechStore'
    });
});

router.get('/producto/:id', getProductDetailPage);

router.get('/vip', (req, res) => {
    res.render('vip', {
        title: 'Membresía VIP | TechStore',
        paymentMode: getPaymentMode(),
        ...getMembershipConfig()
    });
});

router.get('/vip/checkout', requireAuth, getMockCheckoutPage);

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
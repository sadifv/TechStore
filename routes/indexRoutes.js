const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { getProductDetailPage } = require('../controllers/productController');
const { requireAuth } = require('../middleware/authMiddleware');
const { loginUser, registerUser } = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimiter');
const { validate, authValidation } = require('../middleware/validationMiddleware'); // 👈 Importamos validación
const logger = require('../config/logger');

// Ruta principal (Home) - Carga productos destacados + flash sale activa
router.get('/', async (req, res) => {
    try {
        const now = new Date();

        // Consultas en paralelo
        const [featuredProducts, flashSaleProduct] = await Promise.all([
            Product.find()
                .sort({ createdAt: -1 })
                .limit(6)
                .lean(),

            Product.findOne({
                flashSale: true,
                flashSaleEndsAt: { $gt: now }
            })
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

// Vista dedicada para el Catálogo Completo (con filtros y paginación)
router.get('/catalogo', (req, res) => {
    res.render('components/catalog', {
        title: 'Catálogo de Productos - TechStore'
    });
});

// Vista de detalle de un producto
router.get('/producto/:id', getProductDetailPage);

// ==========================================
// AUTENTICACIÓN (LOGIN Y REGISTRO)
// ==========================================

// Vista de Login
router.get('/login', (req, res) => {
    res.render('login', {
        title: 'TechStore - Iniciar Sesión'
    });
});

// POST Login (protegido con rate limit + validación de entrada)
router.post('/login', loginLimiter, validate(authValidation.login), loginUser); // 👈 Validación inyectada

// Vista de Registro
router.get('/register', (req, res) => {
    res.render('register', {
        title: 'TechStore - Crear Cuenta'
    });
});

// POST Registro (si cuentas con endpoint POST para registro)
if (typeof registerUser === 'function') {
    router.post('/register', validate(authValidation.register), registerUser);
}

// ==========================================
// PERFIL
// ==========================================

// Vista del Perfil de Usuario (PROTEGIDA)
router.get('/profile', requireAuth, (req, res) => {
    res.render('profile', {
        title: 'Mi Perfil | TechStore',
        user: req.session.user || req.user
    });
});

module.exports = router;
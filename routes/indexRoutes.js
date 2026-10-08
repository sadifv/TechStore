const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/authMiddleware');
const { loginUser } = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimiter');
const logger = require('../config/logger');

// Ruta principal (Home) - Carga solo 6 productos destacados
router.get('/', async (req, res) => {
    try {
        const featuredProducts = await Product.find()
            .sort({ createdAt: -1 })
            .limit(6)
            .lean();

        res.render('index', {
            title: 'TechStore - Inicio',
            products: featuredProducts
        });
    } catch (error) {
        logger.error(`Error al cargar la página principal: ${error.message}`, { stack: error.stack });
        res.render('index', {
            title: 'TechStore - Inicio',
            products: []
        });
    }
});

// Vista dedicada para el Catálogo Completo (con filtros y paginación)
router.get('/catalogo', (req, res) => {
    res.render('partials/catalog', {
        title: 'Catálogo de Productos - TechStore'
    });
});

// ==========================================
// AUTENTICACIÓN (LOGIN Y REGISTRO)
// ==========================================

// Vista de Login
router.get('/login', (req, res) => {
    res.render('login', {
        title: 'TechStore - Iniciar Sesión'
    });
});

// POST Login (protegido con rate limit)
router.post('/login', loginLimiter, loginUser);

// Vista de Registro
router.get('/register', (req, res) => {
    res.render('register', {
        title: 'TechStore - Crear Cuenta'
    });
});

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
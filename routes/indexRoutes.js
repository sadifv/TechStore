const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { getProductDetailPage } = require('../controllers/productController');
const { requireAuth } = require('../middleware/authMiddleware');
const { loginUser } = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimiter');
const logger = require('../config/logger');

// Ruta principal (Home) - Carga productos destacados + flash sale activa
router.get('/', async (req, res) => {
    try {
        const now = new Date();

        // 1. AUTO-RESTORE: restaurar productos cuya oferta ya expiró
        try {
            const expiredSales = await Product.find({
                flashSale: true,
                flashSaleEndsAt: { $lt: now }
            });

            for (const product of expiredSales) {
                if (product.originalPrice !== null) {
                    product.price = product.originalPrice;
                }
                product.flashSale = false;
                product.flashSaleDiscount = 0;
                product.flashSaleEndsAt = null;
                product.originalPrice = null;
                await product.save();

                logger.info(`Flash sale expirada y restaurada: ${product.name} (ID: ${product._id})`);
            }
        } catch (restoreError) {
            logger.error(`Error al restaurar flash sales expiradas: ${restoreError.message}`);
        }

        // 2. Consultas en paralelo
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
    res.render('partials/catalog', {
        title: 'Catálogo de Productos - TechStore'
    });
});

// ✅ NUEVO: Vista de detalle de un producto
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
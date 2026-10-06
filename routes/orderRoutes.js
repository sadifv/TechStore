const express = require('express');
const router = express.Router();
const { createOrder, confirmOrderPayment, getUserOrders } = require('../controllers/orderController');
const { requireAuth } = require('../middleware/authMiddleware');

// Middleware de autenticación para todas las rutas de órdenes
router.use(requireAuth);

// Crear sesión de pago en Stripe
router.post('/checkout', createOrder);

// Confirmar pago desde Stripe (callback tras pago exitoso)
router.get('/confirm', confirmOrderPayment);

// Obtener historial de órdenes del usuario
router.get('/', getUserOrders);

module.exports = router;
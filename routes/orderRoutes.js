const express = require('express');
const router = express.Router();
const { createOrder, confirmOrderPayment, getUserOrders, handleStripeWebhook } = require('../controllers/orderController');
const { requireAuth } = require('../middleware/authMiddleware');

// Webhook de Stripe (Público, validado con Stripe Signature)
// Nota: El middleware express.raw() se aplica globalmente en server.js
router.post('/webhook', handleStripeWebhook);

// Procesar Checkout y Confirmación de Pago (Público: Soporta Invitados y Autenticados)
router.post('/checkout', createOrder);
router.get('/confirm', confirmOrderPayment);

// Historial de compras (Protegido: requiere inicio de sesión)
router.get('/', requireAuth, getUserOrders);

module.exports = router;
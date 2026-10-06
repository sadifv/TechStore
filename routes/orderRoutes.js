const express = require('express');
const router = express.Router();
const { createOrder, confirmOrderPayment, getUserOrders, handleStripeWebhook } = require('../controllers/orderController');
const { requireAuth } = require('../middleware/authMiddleware');

// 1. RUTA PÚBLICA DE WEBHOOK (Stripe la llama directamente)
// Requiere 'express.raw' para validar la firma criptográfica del evento
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

// 2. MIDDLEWARE DE AUTENTICACIÓN (Aplica solo a las rutas que están abajo)
router.use(requireAuth);

// Rutas protegidas para el cliente/usuario
router.post('/checkout', createOrder);
router.get('/confirm', confirmOrderPayment);
router.get('/', getUserOrders);

module.exports = router;
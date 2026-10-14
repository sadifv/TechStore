const express = require('express');
const router = express.Router();
const { createOrder, cancelOrderCheckout, confirmOrderPayment, getUserOrders, handleStripeWebhook } = require('../controllers/orderController');
const { requireAuth } = require('../middleware/authMiddleware');

// Webhook de Stripe (Público, validado con Stripe Signature)
router.post('/webhook', handleStripeWebhook);

// Procesar Checkout y Confirmación de Pago (Público: Soporta Invitados y Autenticados)
router.post('/checkout', createOrder);
router.get('/cancel', cancelOrderCheckout);
router.get('/confirm', confirmOrderPayment);

// Página de éxito después del pago
router.get('/success', async (req, res, next) => {
    try {
        const { orderId } = req.query;
        if (!orderId) {
            return res.redirect('/');
        }
        const Order = require('../models/Order');
        const order = await Order.findById(orderId).lean();
        if (!order || order.paymentStatus !== 'paid') {
            return res.redirect('/');
        }
        res.render('checkout-success', {
            title: 'Pedido Confirmado | TechStore',
            order
        });
    } catch (error) {
        next(error);
    }
});

// Historial de compras (Protegido: requiere inicio de sesión)
router.get('/', requireAuth, getUserOrders);

module.exports = router;
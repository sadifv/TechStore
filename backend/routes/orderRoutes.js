const express = require('express');
const router = express.Router();
const {
  createOrder,
  cancelOrderCheckout,
  confirmOrderPayment,
  getUserOrders,
  handleStripeWebhook,
} = require('../controllers/orderController');
const { requireAuth } = require('../middleware/authMiddleware');
const { redirectToFrontend } = require('../config/frontendUrl');

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
      if (req.accepts('json'))
        return res
          .status(400)
          .json({ success: false, error: 'Falta el identificador del pedido.' });
      return redirectToFrontend(req, res, '/');
    }
    const Order = require('../models/Order');
    const order = await Order.findById(orderId).lean();
    if (!order || order.paymentStatus !== 'paid') {
      if (req.accepts('json'))
        return res.status(404).json({
          success: false,
          error: 'No se encontró un pedido pagado con ese identificador.',
        });
      return redirectToFrontend(req, res, '/');
    }
    if (req.accepts('json')) {
      return res.json({
        success: true,
        data: {
          _id: order._id,
          totalAmount: order.totalAmount,
          discountAmount: order.discountAmount,
          couponCode: order.couponCode,
          items: order.items.map((item) => ({
            productId: String(item.product),
            quantity: item.quantity,
          })),
          guestOrder: !order.user,
        },
      });
    }
    return redirectToFrontend(
      req,
      res,
      `/checkout-success?orderId=${encodeURIComponent(order._id)}`,
    );
  } catch (error) {
    if (error.name === 'CastError' && req.accepts('json')) {
      return res
        .status(404)
        .json({ success: false, error: 'No se encontró un pedido con ese identificador.' });
    }
    next(error);
  }
});

// Historial de compras (Protegido: requiere inicio de sesión)
router.get('/', requireAuth, getUserOrders);

module.exports = router;

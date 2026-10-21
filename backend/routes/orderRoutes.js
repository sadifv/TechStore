const express = require('express');
const router = express.Router();
const { createOrder, getUserOrders } = require('../controllers/orderController');
const { requireAuth } = require('../middleware/authMiddleware');
const { checkoutLimiter } = require('../middleware/rateLimiter');
const { isOrderSuccessAccessible } = require('../services/orderSuccessAccess');

router.post('/checkout', checkoutLimiter, createOrder);

// Confirmación de que el pedido quedó registrado antes de abrir WhatsApp.
router.post('/success', async (req, res, next) => {
  try {
    const { orderId, checkoutKey } = req.body || {};
    if (typeof orderId !== 'string' || !/^[a-f\d]{24}$/i.test(orderId)) {
      return res.status(400).json({ success: false, error: 'Identificador de pedido inválido.' });
    }

    const Order = require('../models/Order');
    const order = await Order.findById(orderId).lean();
    if (!order || order.paymentMethod !== 'whatsapp') {
      return res.status(404).json({ success: false, error: 'No se encontró el pedido.' });
    }

    const sessionUserId = req.session?.user?.id || req.session?.user?._id;
    if (!isOrderSuccessAccessible({ order, userId: sessionUserId, checkoutKey })) {
      return res.status(404).json({ success: false, error: 'No se encontró el pedido.' });
    }

    return res.json({
      success: true,
      data: {
        _id: order._id,
        totalAmount: order.totalAmount,
        discountAmount: order.discountAmount,
        couponCode: order.couponCode,
        paymentStatus: order.paymentStatus,
        status: order.status,
        contactConfirmed: Boolean(order.contactConfirmedAt),
        expiresAt: new Date(order.createdAt.getTime() + 24 * 60 * 60 * 1000),
        items: order.items.map((item) => ({
          productId: String(item.product),
          quantity: item.quantity,
        })),
        guestOrder: !order.user,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', requireAuth, getUserOrders);

module.exports = router;

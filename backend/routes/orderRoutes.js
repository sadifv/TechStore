const express = require('express');
const router = express.Router();
const { createOrder, getUserOrders } = require('../controllers/orderController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/checkout', createOrder);

// Confirmación de que el pedido quedó registrado antes de abrir WhatsApp.
router.get('/success', async (req, res, next) => {
  try {
    const { orderId } = req.query;
    if (typeof orderId !== 'string' || !/^[a-f\d]{24}$/i.test(orderId)) {
      return res.status(400).json({ success: false, error: 'Identificador de pedido inválido.' });
    }

    const Order = require('../models/Order');
    const order = await Order.findById(orderId).lean();
    if (!order || order.paymentMethod !== 'whatsapp') {
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

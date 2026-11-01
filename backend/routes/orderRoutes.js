const express = require('express');
const router = express.Router();
const { createOrder, getUserOrders } = require('../controllers/orderController');
const { requireAuth, requireOptionalAuth } = require('../middleware/authMiddleware');
const { checkoutLimiter } = require('../middleware/rateLimiter');

router.post('/checkout', checkoutLimiter, requireOptionalAuth, createOrder);

const { getCustomerOrder, cancelCustomerOrder } = require('../controllers/customerOrderController');
const { customerOrderCancelLimiter } = require('../middleware/rateLimiter');

router.post('/success', requireOptionalAuth, getCustomerOrder);
router.post('/track', requireOptionalAuth, getCustomerOrder);
router.post('/cancel', customerOrderCancelLimiter, requireOptionalAuth, cancelCustomerOrder);

router.get('/', requireAuth, getUserOrders);

module.exports = router;

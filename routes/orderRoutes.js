const express = require('express');
const router = express.Router();
const { createOrder, getUserOrders } = require('../controllers/orderController');

// Middleware para verificar autenticación
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            error: 'Debes iniciar sesión para realizar un pedido.'
        });
    }
    next();
};

router.post('/checkout', requireAuth, createOrder);
router.get('/', requireAuth, getUserOrders);

module.exports = router;
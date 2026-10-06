const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');

// Middleware para validar que haya sesión activa
const requireAuth = (req, res, next) => {
    const currentUser = req.session?.user || req.user;
    if (!currentUser) {
        return res.status(401).json({ success: false, error: 'Debes iniciar sesión para gestionar tu carrito.' });
    }
    next();
};

// Obtener el ID del usuario de forma robusta
const getUserId = (req) => req.session?.user?._id || req.session?.user?.id || req.user?._id;

// GET /api/cart - Obtener el carrito del usuario autenticado
router.get('/', requireAuth, async (req, res, next) => {
    try {
        const userId = getUserId(req);
        let cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart) {
            cart = await Cart.create({ user: userId, items: [] });
        }
        res.status(200).json({ success: true, items: cart.items });
    } catch (error) {
        next(error);
    }
});

// POST /api/cart/add - Añadir o incrementar un producto de forma atómica (soluciona race condition)
router.post('/add', requireAuth, async (req, res, next) => {
    try {
        const { productId, quantity = 1 } = req.body;
        const qtyNum = Number(quantity);

        if (!productId) {
            return res.status(400).json({ success: false, error: 'ID de producto requerido.' });
        }

        const userId = getUserId(req);

        // 1. Incrementar la cantidad de forma atómica si el producto ya existe en el carrito
        let cart = await Cart.findOneAndUpdate(
            { user: userId, 'items.product': productId },
            { $inc: { 'items.$.quantity': qtyNum } },
            { new: true }
        );

        // 2. Si el producto no existía en el carrito, añadirlo
        if (!cart) {
            cart = await Cart.findOneAndUpdate(
                { user: userId },
                { $push: { items: { product: productId, quantity: qtyNum } } },
                { new: true, upsert: true }
            );
        }

        // Poblar las referencias de productos para la respuesta del cliente
        const updatedCart = await Cart.findById(cart._id).populate('items.product');

        res.status(200).json({
            success: true,
            message: 'Producto agregado al carrito.',
            items: updatedCart ? updatedCart.items : []
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/cart/remove/:productId - Eliminar un producto del carrito de forma atómica
router.delete('/remove/:productId', requireAuth, async (req, res, next) => {
    try {
        const { productId } = req.params;
        const userId = getUserId(req);

        const updatedCart = await Cart.findOneAndUpdate(
            { user: userId },
            { $pull: { items: { product: productId } } },
            { new: true }
        ).populate('items.product');

        res.status(200).json({
            success: true,
            message: 'Producto eliminado del carrito.',
            items: updatedCart ? updatedCart.items : []
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');

// Middleware para validar que haya sesión activa
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, error: 'Debes iniciar sesión para gestionar tu carrito.' });
    }
    next();
};

// GET /api/cart - Obtener el carrito del usuario autenticado
router.get('/', requireAuth, async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.session.user.id }).populate('items.product');
        if (!cart) {
            cart = new Cart({ user: req.session.user.id, items: [] });
            await cart.save();
        }
        res.status(200).json({ success: true, items: cart.items });
    } catch (error) {
        console.error('Error al obtener carrito:', error);
        res.status(500).json({ success: false, error: 'Error del servidor al obtener el carrito.' });
    }
});

// POST /api/cart/add - Añadir o incrementar un producto
router.post('/add', requireAuth, async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        if (!productId) {
            return res.status(400).json({ success: false, error: 'ID de producto requerido.' });
        }

        let cart = await Cart.findOne({ user: req.session.user.id });
        if (!cart) {
            cart = new Cart({ user: req.session.user.id, items: [] });
        }

        const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += Number(quantity);
        } else {
            cart.items.push({ product: productId, quantity: Number(quantity) });
        }

        await cart.save();
        const updatedCart = await Cart.findById(cart._id).populate('items.product');

        res.status(200).json({
            success: true,
            message: 'Producto agregado al carrito.',
            items: updatedCart.items
        });
    } catch (error) {
        console.error('Error al agregar al carrito:', error);
        res.status(500).json({ success: false, error: 'Error del servidor al actualizar el carrito.' });
    }
});

// DELETE /api/cart/remove/:productId - Eliminar un producto del carrito
router.delete('/remove/:productId', requireAuth, async (req, res) => {
    try {
        const { productId } = req.params;
        let cart = await Cart.findOne({ user: req.session.user.id });

        if (cart) {
            cart.items = cart.items.filter(item => item.product.toString() !== productId);
            await cart.save();
        }

        const updatedCart = await Cart.findOne({ user: req.session.user.id }).populate('items.product');
        res.status(200).json({ success: true, items: updatedCart ? updatedCart.items : [] });
    } catch (error) {
        console.error('Error al eliminar del carrito:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar el producto.' });
    }
});

module.exports = router;
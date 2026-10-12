const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const logger = require('../config/logger');

const MAX_QUANTITY_PER_PRODUCT = 99;

// Middleware para validar que haya sesión activa
const requireAuth = (req, res, next) => {
    const currentUser = req.session?.user || req.user;
    if (!currentUser) {
        return res.status(401).json({ success: false, error: 'Debes iniciar sesión para gestionar tu carrito.' });
    }
    next();
};

const getUserId = (req) => req.session?.user?._id || req.session?.user?.id || req.user?._id;

// ✅ Validar y normalizar la cantidad
const parseQuantity = (raw) => {
    const qty = Number(raw);
    if (!Number.isInteger(qty)) return null;
    if (qty < 1 || qty > MAX_QUANTITY_PER_PRODUCT) return null;
    return qty;
};

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

// POST /api/cart/add
router.post('/add', requireAuth, async (req, res, next) => {
    try {
        const { productId, quantity } = req.body;

        // ✅ Validar productId
        if (!productId) {
            return res.status(400).json({ success: false, error: 'ID de producto requerido.' });
        }

        // ✅ Validar cantidad
        const qtyNum = parseQuantity(quantity === undefined ? 1 : quantity);
        if (qtyNum === null) {
            return res.status(400).json({
                success: false,
                error: `La cantidad debe ser un número entero entre 1 y ${MAX_QUANTITY_PER_PRODUCT}.`
            });
        }

        // ✅ Verificar que el producto existe Y tiene stock
        const product = await Product.findById(productId).select('stock name').lean();
        if (!product) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado.' });
        }
        if (product.stock <= 0) {
            return res.status(400).json({ success: false, error: 'Producto sin stock disponible.' });
        }

        const userId = getUserId(req);

        // 1. Incrementar cantidad si ya existe
        let cart = await Cart.findOneAndUpdate(
            { user: userId, 'items.product': productId },
            { $inc: { 'items.$.quantity': qtyNum } },
            { new: true }
        );

        // 2. Si no existía, añadirlo
        if (!cart) {
            cart = await Cart.findOneAndUpdate(
                { user: userId },
                { $push: { items: { product: productId, quantity: qtyNum } } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
        }

        // ✅ Limitar si excede el máximo
        const item = cart.items.find(i => i.product.toString() === productId);
        if (item && item.quantity > MAX_QUANTITY_PER_PRODUCT) {
            await Cart.updateOne(
                { user: userId, 'items.product': productId },
                { $set: { 'items.$.quantity': MAX_QUANTITY_PER_PRODUCT } }
            );
            const cappedCart = await Cart.findById(cart._id).populate('items.product');
            return res.status(200).json({
                success: true,
                message: `Cantidad máxima (${MAX_QUANTITY_PER_PRODUCT}) alcanzada.`,
                items: cappedCart?.items || []
            });
        }

        const populatedCart = await Cart.findById(cart._id).populate('items.product');
        logger.info(`Carrito actualizado para usuario ${userId}: ${product.name} x${qtyNum}`);

        res.status(200).json({
            success: true,
            message: 'Producto agregado al carrito.',
            items: populatedCart ? populatedCart.items : []
        });
    } catch (error) {
        logger.error(`Error al añadir producto al carrito: ${error.message}`, { stack: error.stack });
        next(error);
    }
});

// DELETE /api/cart/remove/:productId
router.delete('/remove/:productId', requireAuth, async (req, res, next) => {
    try {
        const { productId } = req.params;
        const userId = getUserId(req);

        if (!productId) {
            return res.status(400).json({ success: false, error: 'ID de producto requerido.' });
        }

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
        logger.error(`Error al eliminar producto del carrito: ${error.message}`, { stack: error.stack });
        next(error);
    }
});

module.exports = router;
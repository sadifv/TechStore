const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const logger = require('../config/logger');

const RESERVATION_EXPIRY_MINUTES = 60;

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
        if (!mongoose.isObjectIdOrHexString(productId)) {
            return res.status(400).json({ success: false, error: 'ID de producto inválido.' });
        }

        // ✅ Validar cantidad
        const qtyNum = parseQuantity(quantity === undefined ? 1 : quantity);
        if (qtyNum === null) {
            return res.status(400).json({
                success: false,
                error: `La cantidad debe ser un número entero entre 1 y ${MAX_QUANTITY_PER_PRODUCT}.`
            });
        }

        // ✅ Verificar que el producto existe Y tiene stock disponible
        const productObjectId = new mongoose.Types.ObjectId(productId);
        const product = await Product.findById(productObjectId).select('stock name').lean();
        if (!product) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado.' });
        }

        // Calcular stock disponible descontando reservas activas
        const reservedStock = await Reservation.getReservedStock(product._id);
        const availableStock = Math.max(0, product.stock - reservedStock);

        if (availableStock <= 0) {
            return res.status(400).json({ success: false, error: 'Producto sin stock disponible.' });
        }
        if (qtyNum > availableStock) {
            return res.status(400).json({
                success: false,
                error: `Solo hay ${availableStock} unidades disponibles.`
            });
        }

        const userId = getUserId(req);

        // 1. Incrementar cantidad si ya existe
        let cart = await Cart.findOneAndUpdate(
            { user: userId, 'items.product': productObjectId },
            { $inc: { 'items.$.quantity': qtyNum } },
            {
              returnDocument: 'after'
            }
        );

        // 2. Si no existía, añadirlo
        if (!cart) {
            cart = await Cart.findOneAndUpdate(
                { user: userId },
                { $push: { items: { product: productObjectId, quantity: qtyNum } } },
                {
                  returnDocument: 'after',
                  upsert: true,
                  setDefaultsOnInsert: true
                }
            );
        }

        // ✅ Limitar si excede el máximo
        const item = cart.items.find(i => i.product.toString() === productObjectId.toString());
        if (item && item.quantity > MAX_QUANTITY_PER_PRODUCT) {
            await Cart.updateOne(
                { user: userId, 'items.product': productObjectId },
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

        // ✅ Crear reserva temporal (expira en 1 hora)
        await Reservation.findOneAndUpdate(
            { user: userId, product: productObjectId, status: 'active' },
            {
                user: userId,
                product: productObjectId,
                quantity: item ? item.quantity : qtyNum,
                expiresAt: new Date(Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000),
                status: 'active'
            },
            {
              returnDocument: 'after',
              upsert: true,
              setDefaultsOnInsert: true
            }
        );

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

        if (!mongoose.isObjectIdOrHexString(productId)) {
            return res.status(400).json({ success: false, error: 'ID de producto inválido.' });
        }

        const updatedCart = await Cart.findOneAndUpdate(
            { user: userId },
            { $pull: { items: { product: productId } } },
            {
              returnDocument: 'after'
            }
        ).populate('items.product');

        // ✅ Cancelar reserva asociada
        await Reservation.updateMany(
            { user: userId, product: productId, status: 'active' },
            { $set: { status: 'cancelled' } }
        );

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
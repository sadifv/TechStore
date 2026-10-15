const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const logger = require('../config/logger');
const { withProductReservationLock } = require('../services/productReservationLock');

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

const getAvailableStockForUser = async (product, userId) => {
    const now = new Date();
    const [reservedStock, ownReservation] = await Promise.all([
        Reservation.getReservedStock(product._id),
        Reservation.findOne({
            user: userId,
            product: product._id,
            status: 'active',
            expiresAt: { $gt: now }
        }).select('quantity').lean()
    ]);

    return Math.max(0, product.stock - reservedStock + (ownReservation?.quantity || 0));
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

        const productObjectId = new mongoose.Types.ObjectId(productId);
        const response = await withProductReservationLock(productObjectId, async () => {
            const product = await Product.findById(productObjectId).select('stock name').lean();
            if (!product) {
                return { status: 404, body: { success: false, error: 'Producto no encontrado.' } };
            }

            const userId = getUserId(req);
            const [existingCart, availableStock] = await Promise.all([
                Cart.findOne({ user: userId }).select('items').lean(),
                getAvailableStockForUser(product, userId)
            ]);
            const existingItem = existingCart?.items.find(
                item => item.product.toString() === productObjectId.toString()
            );
            const currentQuantity = existingItem?.quantity || 0;
            const nextQuantity = currentQuantity + qtyNum;
            const maxAllowedQuantity = Math.min(availableStock, MAX_QUANTITY_PER_PRODUCT);

            if (nextQuantity > maxAllowedQuantity) {
                const remaining = Math.max(0, maxAllowedQuantity - currentQuantity);
                return {
                    status: 400,
                    body: {
                        success: false,
                        error: remaining > 0
                            ? `Solo puedes agregar ${remaining} unidad(es) más. Ya tienes ${currentQuantity} en el carrito y hay ${maxAllowedQuantity} disponibles.`
                            : `Ya tienes ${currentQuantity} unidad(es) en el carrito, que alcanza(n) el stock disponible (${maxAllowedQuantity}).`
                    }
                };
            }

            await Cart.findOneAndUpdate(
                { user: userId },
                { $setOnInsert: { user: userId } },
                { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
            );

            let cart = await Cart.findOneAndUpdate(
                {
                    user: userId,
                    items: {
                        $elemMatch: {
                            product: productObjectId,
                            quantity: { $lte: maxAllowedQuantity - qtyNum }
                        }
                    }
                },
                { $inc: { 'items.$.quantity': qtyNum } },
                { returnDocument: 'after' }
            );

            if (!cart) {
                cart = await Cart.findOneAndUpdate(
                    { user: userId, items: { $not: { $elemMatch: { product: productObjectId } } } },
                    { $push: { items: { product: productObjectId, quantity: qtyNum } } },
                    { returnDocument: 'after' }
                );
            }

            if (!cart) {
                return {
                    status: 400,
                    body: {
                        success: false,
                        error: 'La cantidad solicitada supera el stock disponible. Actualiza el carrito e inténtalo de nuevo.'
                    }
                };
            }

            const item = cart.items.find(i => i.product.toString() === productObjectId.toString());
            const populatedCart = await Cart.findById(cart._id).populate('items.product');
            await Reservation.findOneAndUpdate(
                { user: userId, product: productObjectId, status: 'active' },
                {
                    user: userId,
                    product: productObjectId,
                    quantity: item ? item.quantity : qtyNum,
                    expiresAt: new Date(Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000),
                    status: 'active'
                },
                { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
            );
            logger.info(`Carrito actualizado para usuario ${userId}: ${product.name} x${qtyNum}`);

            return {
                status: 200,
                body: { success: true, message: 'Producto agregado al carrito.', items: populatedCart?.items || [] }
            };
        });
        return res.status(response.status).json(response.body);
    } catch (error) {
        logger.error(`Error al añadir producto al carrito: ${error.message}`, { stack: error.stack });
        next(error);
    }
});

// PATCH /api/cart/quantity/:productId
router.patch('/quantity/:productId', requireAuth, async (req, res, next) => {
    try {
        const { productId } = req.params;
        const quantity = parseQuantity(req.body.quantity);
        const userId = getUserId(req);

        if (!mongoose.isObjectIdOrHexString(productId)) {
            return res.status(400).json({ success: false, error: 'ID de producto inválido.' });
        }
        if (quantity === null) {
            return res.status(400).json({
                success: false,
                error: `La cantidad debe ser un número entero entre 1 y ${MAX_QUANTITY_PER_PRODUCT}.`
            });
        }

        const response = await withProductReservationLock(productId, async () => {
            const product = await Product.findById(productId).select('stock name').lean();
            if (!product) {
                return { status: 404, body: { success: false, error: 'Producto no encontrado.' } };
            }
            const availableStock = await getAvailableStockForUser(product, userId);
            const maxAllowedQuantity = Math.min(availableStock, MAX_QUANTITY_PER_PRODUCT);
            if (quantity > maxAllowedQuantity) {
                return {
                    status: 400,
                    body: { success: false, error: `Solo hay ${maxAllowedQuantity} unidades disponibles para este producto.` }
                };
            }

            const cart = await Cart.findOneAndUpdate(
                { user: userId, 'items.product': productId },
                { $set: { 'items.$.quantity': quantity } },
                { returnDocument: 'after' }
            ).populate('items.product');

            if (!cart) {
                return { status: 404, body: { success: false, error: 'El producto no está en el carrito.' } };
            }

            await Reservation.findOneAndUpdate(
                { user: userId, product: productId, status: 'active' },
                {
                    quantity,
                    expiresAt: new Date(Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000),
                    status: 'active'
                },
                { upsert: true, setDefaultsOnInsert: true }
            );

            return {
                status: 200,
                body: { success: true, message: 'Cantidad actualizada.', items: cart.items }
            };
        });
        return res.status(response.status).json(response.body);
    } catch (error) {
        logger.error(`Error al actualizar cantidad del carrito: ${error.message}`, { stack: error.stack });
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

        const removeItem = async () => {
            const updatedCart = await Cart.findOneAndUpdate(
                { user: userId },
                { $pull: { items: { product: productId } } },
                { returnDocument: 'after' }
            ).populate('items.product');

            await Reservation.updateMany(
                { user: userId, product: productId, status: 'active' },
                { $set: { status: 'cancelled' } }
            );

            return {
                status: 200,
                body: {
                    success: true,
                    message: 'Producto eliminado del carrito.',
                    items: updatedCart ? updatedCart.items : []
                }
            };
        };

        const productExists = await Product.exists({ _id: productId });
        const response = productExists
            ? await withProductReservationLock(productId, removeItem)
            : await removeItem();
        return res.status(response.status).json(response.body);
    } catch (error) {
        logger.error(`Error al eliminar producto del carrito: ${error.message}`, { stack: error.stack });
        next(error);
    }
});

module.exports = router;
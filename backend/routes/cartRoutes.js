const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const logger = require('../config/logger');
const { isProductArchived } = require('../services/productAvailability');
const { toPublicProduct } = require('../services/productPricing');
const { withProductReservationLock } = require('../services/productReservationLock');
const { requireAuth } = require('../middleware/authMiddleware');
const { inSession } = require('../services/inventoryTransaction');

const RESERVATION_EXPIRY_MINUTES = 60;

const MAX_QUANTITY_PER_PRODUCT = 99;

const getUserId = (req) => req.session?.user?._id || req.session?.user?.id || req.user?._id;
const publicCartItems = (items = []) => items.map((entry) => {
  const item = entry.toObject ? entry.toObject() : entry;
  return { ...item, product: item.product && !isProductArchived(item.product)
    ? toPublicProduct(item.product) : null };
});

// ✅ Validar y normalizar la cantidad
const parseQuantity = (raw) => {
  const qty = Number(raw);
  if (!Number.isInteger(qty)) return null;
  if (qty < 1 || qty > MAX_QUANTITY_PER_PRODUCT) return null;
  return qty;
};

const getAvailableStockForUser = async (product, userId, session) => {
  const reservedStock = await Reservation.getReservedStock(product._id, { session });
  const ownReservation = await inSession(
    Reservation.findOne({
      user: userId,
      product: product._id,
      status: 'active',
      expiresAt: { $gt: new Date() },
    }).select('quantity'),
    session,
  ).lean();
  return Math.max(0, product.stock - reservedStock + (ownReservation?.quantity || 0));
};

// GET /api/cart - Obtener el carrito del usuario autenticado
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    let cart = await Cart.findOne({ user: userId }).lean();
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }
    const productIds = cart.items.map((item) => item.product).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productsById = new Map(products.map((product) => [String(product._id), product]));
    const items = cart.items.map((item) => ({
      _id: item._id,
      productId: item.product ? String(item.product) : null,
      product: isProductArchived(productsById.get(String(item.product)))
        ? null
        : productsById.has(String(item.product))
          ? toPublicProduct(productsById.get(String(item.product)))
          : null,
      quantity: item.quantity,
    }));
    res.status(200).json({ success: true, items });
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
        error: `La cantidad debe ser un número entero entre 1 y ${MAX_QUANTITY_PER_PRODUCT}.`,
      });
    }

    const productObjectId = new mongoose.Types.ObjectId(productId);
    const response = await withProductReservationLock(productObjectId, async (_lease, session) => {
      const product = await inSession(
        Product.findById(productObjectId).select('stock name archivedAt'),
        session,
      ).lean();
      if (!product || isProductArchived(product)) {
        return { status: 404, body: { success: false, error: 'Producto no encontrado.' } };
      }

      const userId = getUserId(req);
      const existingCart = await inSession(
        Cart.findOne({ user: userId }).select('items'),
        session,
      ).lean();
      const availableStock = await getAvailableStockForUser(product, userId, session);
      const existingItem = existingCart?.items.find(
        (item) => item.product.toString() === productObjectId.toString(),
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
            error:
              remaining > 0
                ? `Solo puedes agregar ${remaining} unidad(es) más. Ya tienes ${currentQuantity} en el carrito y hay ${maxAllowedQuantity} disponibles.`
                : `Ya tienes ${currentQuantity} unidad(es) en el carrito, que alcanza(n) el stock disponible (${maxAllowedQuantity}).`,
          },
        };
      }

      await Cart.findOneAndUpdate(
        { user: userId },
        { $setOnInsert: { user: userId } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, session },
      );

      let cart = await Cart.findOneAndUpdate(
        {
          user: userId,
          items: {
            $elemMatch: {
              product: productObjectId,
              quantity: { $lte: maxAllowedQuantity - qtyNum },
            },
          },
        },
        { $inc: { 'items.$.quantity': qtyNum } },
        { returnDocument: 'after', session },
      );

      if (!cart) {
        cart = await Cart.findOneAndUpdate(
          { user: userId, items: { $not: { $elemMatch: { product: productObjectId } } } },
          { $push: { items: { product: productObjectId, quantity: qtyNum } } },
          { returnDocument: 'after', session },
        );
      }

      if (!cart) {
        return {
          status: 400,
          body: {
            success: false,
            error:
              'La cantidad solicitada supera el stock disponible. Actualiza el carrito e inténtalo de nuevo.',
          },
        };
      }

      const item = cart.items.find((i) => i.product.toString() === productObjectId.toString());
      const populatedCart = await inSession(
        Cart.findById(cart._id).populate('items.product'),
        session,
      );
      await Reservation.findOneAndUpdate(
        { user: userId, product: productObjectId, status: 'active' },
        {
          user: userId,
          product: productObjectId,
          quantity: item ? item.quantity : qtyNum,
          expiresAt: new Date(Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000),
          status: 'active',
        },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, session },
      );
      logger.info('Carrito actualizado.');

      return {
        status: 200,
        body: {
          success: true,
          message: 'Producto agregado al carrito.',
          items: publicCartItems(populatedCart?.items),
        },
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
        error: `La cantidad debe ser un número entero entre 1 y ${MAX_QUANTITY_PER_PRODUCT}.`,
      });
    }

    const response = await withProductReservationLock(productId, async (_lease, session) => {
      const product = await inSession(
        Product.findById(productId).select('stock name archivedAt'),
        session,
      ).lean();
      if (!product || isProductArchived(product)) {
        return { status: 404, body: { success: false, error: 'Producto no encontrado.' } };
      }
      const availableStock = await getAvailableStockForUser(product, userId, session);
      const maxAllowedQuantity = Math.min(availableStock, MAX_QUANTITY_PER_PRODUCT);
      if (quantity > maxAllowedQuantity) {
        return {
          status: 400,
          body: {
            success: false,
            error: `Solo hay ${maxAllowedQuantity} unidades disponibles para este producto.`,
          },
        };
      }

      const cart = await Cart.findOneAndUpdate(
        { user: userId, 'items.product': productId },
        { $set: { 'items.$.quantity': quantity } },
        { returnDocument: 'after', session },
      ).populate('items.product');

      if (!cart) {
        return {
          status: 404,
          body: { success: false, error: 'El producto no está en el carrito.' },
        };
      }

      await Reservation.findOneAndUpdate(
        { user: userId, product: productId, status: 'active' },
        {
          quantity,
          expiresAt: new Date(Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000),
          status: 'active',
        },
        { upsert: true, setDefaultsOnInsert: true, session },
      );

      return {
        status: 200,
        body: { success: true, message: 'Cantidad actualizada.', items: publicCartItems(cart.items) },
      };
    });
    return res.status(response.status).json(response.body);
  } catch (error) {
    logger.error(`Error al actualizar cantidad del carrito: ${error.message}`, {
      stack: error.stack,
    });
    next(error);
  }
});

// Elimina por el ID del subdocumento para permitir retirar referencias de
// productos que fueron borrados o quedaron huérfanas en un carrito existente.
router.delete('/item/:itemId', requireAuth, async (req, res, next) => {
  try {
    const { itemId } = req.params;
    if (!mongoose.isObjectIdOrHexString(itemId)) {
      return res.status(400).json({ success: false, error: 'ID de artículo inválido.' });
    }

    const cart = await Cart.findOne({ user: getUserId(req) });
    const item = cart?.items.id(itemId);
    if (!cart || !item) {
      return res
        .status(404)
        .json({ success: false, error: 'El artículo ya no está en el carrito.' });
    }

    const productId = item.product;
    await withProductReservationLock(String(productId || cart._id), async (_lease, session) => {
      await Cart.updateOne(
        { _id: cart._id, user: getUserId(req) },
        { $pull: { items: { _id: itemId } } },
        { session },
      );
      if (productId && mongoose.isObjectIdOrHexString(String(productId))) {
        await Reservation.updateMany(
          { user: getUserId(req), product: productId, status: 'active' },
          { $set: { status: 'cancelled' } },
          { session },
        );
      }
    });
    return res.json({ success: true, message: 'Producto eliminado del carrito.' });
  } catch (error) {
    logger.error(`Error al eliminar artículo del carrito: ${error.message}`, {
      stack: error.stack,
    });
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

    const removeItem = async (_lease, session) => {
      const updatedCart = await Cart.findOneAndUpdate(
        { user: userId },
        { $pull: { items: { product: productId } } },
        { returnDocument: 'after', session },
      ).populate('items.product');

      await Reservation.updateMany(
        { user: userId, product: productId, status: 'active' },
        { $set: { status: 'cancelled' } },
        { session },
      );

      return {
        status: 200,
        body: {
          success: true,
          message: 'Producto eliminado del carrito.',
          items: publicCartItems(updatedCart?.items),
        },
      };
    };

    const response = await withProductReservationLock(productId, removeItem);
    return res.status(response.status).json(response.body);
  } catch (error) {
    logger.error(`Error al eliminar producto del carrito: ${error.message}`, {
      stack: error.stack,
    });
    next(error);
  }
});

module.exports = router;

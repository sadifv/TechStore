const mongoose = require('mongoose');
const crypto = require('node:crypto');
const { getWhatsappPhone, buildWhatsappOrderUrl } = require('../config/whatsapp');
const { orderEvent } = require('../services/orderAudit');

const respondToRetry = (order, requestHash, req, res) => {
  if (order.checkoutRequestHash !== requestHash) {
    return res
      .status(409)
      .json({ success: false, error: 'Este intento corresponde a otro carrito.' });
  }
  if (order.paymentStatus === 'failed' && order.inventoryRestored) {
    return res
      .status(409)
      .json({
        success: false,
        checkoutRetryAllowed: true,
        error:
          'El pedido anterior fue cancelado y su reserva se liberó. Pulsa de nuevo para crear otro pedido.',
      });
  }
  if (
    order.paymentStatus === 'pending' &&
    order.createdAt <= new Date(Date.now() - 24 * 60 * 60 * 1000)
  ) {
    return res
      .status(409)
      .json({
        success: false,
        error: 'La reserva del pedido venció. Contacta con la tienda para reanudar la compra.',
      });
  }
  if (order.checkoutState !== 'ready' || order.paymentStatus === 'failed') {
    return res
      .status(409)
      .json({
        success: false,
        error:
          'El pedido está en proceso o no pudo completarse. Revisa tus pedidos antes de iniciar otro intento.',
      });
  }
  return res.json({
    success: true,
    orderId: order._id,
    whatsappUrl: buildWhatsappOrderUrl(order, req.session?.user),
  });
};
const Order = require('../models/Order');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const Cart = require('../models/Cart');
const logger = require('../config/logger');
const { getCouponDiscount, reserveCoupon } = require('../services/couponService');
const { acquireProductReservationLocks } = require('../services/productReservationLock');

const { restoreOrderInventory } = require('../services/orderInventory');
const { reconcileOrderCart } = require('../services/orderPayment');
const createOrder = async (req, res, next) => {
  let newOrder;
  let reservedItems = [];
  let couponDiscount;
  let releaseStockLocks;
  let checkoutKey;
  let checkoutRequestHash;
  try {
    getWhatsappPhone();
    const key = req.body.checkoutKey;
    if (key !== undefined) {
      if (typeof key !== 'string' || !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(key)) {
        return res
          .status(400)
          .json({ success: false, error: 'Identificador de intento inválido.' });
      }
      const scope = req.session?.user?.id || req.session?.user?._id || 'guest';
      checkoutKey = crypto.createHash('sha256').update(`${scope}:${key}`).digest('hex');
      const payload = { ...req.body };
      delete payload.checkoutKey;
      checkoutRequestHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
      const existing = await Order.findOne({ checkoutKey });
      if (existing) return respondToRetry(existing, checkoutRequestHash, req, res);
    }
    const { items, guestInfo, shippingAddress, couponCode } = req.body;

    // FIX: Validar items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar al menos un item en la orden.',
      });
    }

    // FIX: Validar límite máximo de items por orden
    if (items.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'La orden no puede superar los 50 productos diferentes.',
      });
    }

    const userId = req.session?.user?.id || req.session?.user?._id;
    const normalizedItems = new Map();
    for (const item of items) {
      if (!item?.productId || !mongoose.isObjectIdOrHexString(item.productId)) {
        return res.status(400).json({
          success: false,
          error: 'Cada item debe tener un productId válido.',
        });
      }

      const quantity = item.quantity === undefined ? 1 : Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return res.status(400).json({
          success: false,
          error: `Cantidad inválida para el producto ${item.productId}. Debe ser entre 1 y 99.`,
        });
      }

      const productId = item.productId.toString();
      const combinedQuantity = (normalizedItems.get(productId) || 0) + quantity;
      if (combinedQuantity > 99) {
        return res.status(400).json({
          success: false,
          error: `La cantidad total por producto no puede superar 99.`,
        });
      }
      normalizedItems.set(productId, combinedQuantity);
    }

    releaseStockLocks = await acquireProductReservationLocks([...normalizedItems.keys()]);
    if (checkoutKey) {
      const existing = await Order.findOne({ checkoutKey });
      if (existing) return respondToRetry(existing, checkoutRequestHash, req, res);
    }

    // Calcular totalAmount desde los productos en DB
    let totalAmount = 0;
    const orderItems = [];
    const reservedStockByProduct = new Map();

    for (const [productId, quantity] of normalizedItems) {
      const product = await Product.findById(productId).lean();
      if (!product) {
        return res.status(400).json({
          success: false,
          error: `Producto con ID ${productId} no encontrado.`,
        });
      }

      const reservedStock = await Reservation.getReservedStock(product._id);
      const ownReservation = userId
        ? await Reservation.findOne({
            user: userId,
            product: product._id,
            status: 'active',
            expiresAt: { $gt: new Date() },
          }).lean()
        : null;
      const availableStock = Math.max(
        0,
        product.stock - reservedStock + (ownReservation?.quantity || 0),
      );

      if (availableStock < quantity) {
        return res.status(400).json({
          success: false,
          error: `Stock insuficiente para "${product.name}". Disponible: ${availableStock}.`,
        });
      }

      totalAmount += product.price * quantity;
      reservedStockByProduct.set(
        product._id.toString(),
        Math.max(0, reservedStock - (ownReservation?.quantity || 0)),
      );

      // ✅ Snapshot del nombre (por si el producto se elimina después)
      orderItems.push({
        product: product._id,
        productName: product.name,
        quantity,
        price: product.price,
      });
    }

    totalAmount = Number(totalAmount.toFixed(2));
    if (couponCode) {
      couponDiscount = await getCouponDiscount({
        code: couponCode,
        subtotal: totalAmount,
      });
    }

    const discountAmount = couponDiscount?.discountAmount || 0;
    const finalAmount = Number((totalAmount - discountAmount).toFixed(2));
    let cartSnapshotUpdatedAt;
    if (userId) {
      const userCart = await Cart.findOne({ user: userId }).select('items updatedAt').lean();
      const cartQuantities = new Map(
        (userCart?.items || []).map((item) => [item.product.toString(), item.quantity]),
      );
      const submittedQuantities = new Map(
        orderItems.map((item) => [item.product.toString(), item.quantity]),
      );
      if (
        userCart?.updatedAt &&
        cartQuantities.size === submittedQuantities.size &&
        [...submittedQuantities].every(
          ([productId, quantity]) => cartQuantities.get(productId) === quantity,
        )
      ) {
        cartSnapshotUpdatedAt = userCart.updatedAt;
      }
    }

    // Construir datos de la orden
    const orderData = {
      checkoutKey,
      checkoutRequestHash,
      checkoutState: 'creating',
      events: [orderEvent('created', userId)],
      items: orderItems,
      subtotalAmount: totalAmount,
      totalAmount: finalAmount,
      discountAmount,
      coupon: couponDiscount?.coupon._id,
      couponCode: couponDiscount?.coupon.code,
      couponReservationStatus: couponDiscount ? 'reserved' : 'none',
      couponReservationManaged: couponDiscount ? false : undefined,
      paymentStatus: 'pending',
      status: 'pending',
      paymentMethod: 'whatsapp',
      cartSnapshotUpdatedAt,
      inventoryRestored: false,
    };

    if (userId) {
      orderData.user = userId;
    } else {
      if (!guestInfo?.name || !guestInfo?.email) {
        return res.status(400).json({
          success: false,
          error: 'Para compras como invitado se requiere name y email.',
        });
      }
      orderData.guestInfo = guestInfo;
    }

    if (shippingAddress) {
      orderData.shippingAddress = shippingAddress;
    }

    // Crear la orden en MongoDB
    newOrder = await Order.create(orderData);

    if (couponDiscount) {
      await reserveCoupon(couponDiscount.coupon, newOrder._id);
      newOrder.couponReservationManaged = true;
      await newOrder.save();
    }

    // Descontar inventario con una operación condicional para evitar stock negativo.
    for (const [index, item] of orderItems.entries()) {
      const result = await Product.updateOne(
        {
          _id: item.product,
          stock: { $gte: item.quantity + reservedStockByProduct.get(item.product.toString()) },
        },
        { $inc: { stock: -item.quantity } },
      );
      if (result.modifiedCount !== 1) {
        await releaseStockLocks();
        releaseStockLocks = null;
        await restoreOrderInventory(newOrder._id, reservedItems);
        return res.status(409).json({
          success: false,
          error: `El stock de "${item.productName}" cambió. Actualiza el carrito e inténtalo de nuevo.`,
        });
      }
      reservedItems.push(item);
      newOrder.items[index].inventoryReserved = true;
      await newOrder.save();
    }

    if (userId) {
      await Reservation.updateMany(
        {
          user: userId,
          product: { $in: orderItems.map((item) => item.product) },
          status: 'active',
        },
        { $set: { status: 'completed' } },
      );
    }
    await releaseStockLocks();
    releaseStockLocks = null;

    const whatsappUrl = buildWhatsappOrderUrl(newOrder, req.session?.user);
    newOrder.checkoutState = 'ready';
    await newOrder.save();
    if (userId) await reconcileOrderCart(newOrder);

    logger.info(`Orden creada: ${newOrder._id} - Total: $${finalAmount.toFixed(2)}.`);

    res.status(201).json({
      success: true,
      orderId: newOrder._id,
      whatsappUrl,
    });
  } catch (error) {
    if (error.code === 11000 && checkoutKey && !newOrder) {
      const existing = await Order.findOne({ checkoutKey });
      if (existing) return respondToRetry(existing, checkoutRequestHash, req, res);
    }
    if (newOrder) {
      try {
        if (releaseStockLocks) {
          await releaseStockLocks();
          releaseStockLocks = null;
        }
        await restoreOrderInventory(newOrder._id, reservedItems);
      } catch (restoreError) {
        logger.error(
          `No se pudo restituir el inventario de la orden ${newOrder._id}: ${restoreError.message}`,
          {
            stack: restoreError.stack,
          },
        );
      }
    }
    logger.error(`Error al crear orden: ${error.message}`, { stack: error.stack });
    if (error.statusCode && !newOrder) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    next(error);
  } finally {
    if (releaseStockLocks) {
      await releaseStockLocks();
    }
  }
};

module.exports = { createOrder };

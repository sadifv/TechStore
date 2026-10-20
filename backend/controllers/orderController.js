const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const Cart = require('../models/Cart');
const logger = require('../config/logger');
const {
  getCouponDiscount,
  reserveCoupon,
  releaseCouponReservation,
  consumeCouponReservation,
} = require('../services/couponService');
const { acquireProductReservationLocks } = require('../services/productReservationLock');

const restoreOrderInventory = async (orderId, items) => {
  let order = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: 'pending', inventoryRestored: { $ne: true } },
    {
      $set: { paymentStatus: 'failed', status: 'cancelled' },
    },
    { returnDocument: 'after' },
  );

  if (!order) {
    order = await Order.findOne({
      _id: orderId,
      paymentStatus: 'failed',
      inventoryRestored: { $ne: true },
    });
  }
  if (!order) return false;

  const itemsToRestore = items || order.items.filter((item) => item.inventoryReserved);
  const releaseProductLocks = await acquireProductReservationLocks(
    itemsToRestore.map((item) => item.product),
  );
  try {
    const completedOrder = await Order.exists({
      _id: order._id,
      paymentStatus: 'failed',
      inventoryRestored: true,
    });
    if (completedOrder) return false;

    for (const item of itemsToRestore) {
      // The marker and stock increment share one product update for safe retry handling.
      const restorationKey = `${order._id}:${item.product}`;
      const result = await Product.updateOne(
        { _id: item.product, inventoryRestorationKeys: { $ne: restorationKey } },
        {
          $inc: { stock: item.quantity },
          $addToSet: { inventoryRestorationKeys: restorationKey },
        },
      );

      if (result.modifiedCount !== 1) {
        const alreadyRestored = await Product.exists({
          _id: item.product,
          inventoryRestorationKeys: restorationKey,
        });
        if (!alreadyRestored) {
          throw new Error(
            `No se pudo restituir el inventario del producto ${item.product} para la orden ${order._id}.`,
          );
        }
      }
    }

    if (order.couponReservationStatus === 'reserved' && order.coupon) {
      await releaseCouponReservation(
        order.coupon,
        order._id,
        order.couponReservationManaged === undefined,
      );
      await Order.updateOne(
        { _id: orderId, couponReservationStatus: 'reserved' },
        { $set: { couponReservationStatus: 'released' } },
      );
    }

    const finalized = await Order.updateOne(
      { _id: order._id, paymentStatus: 'failed', inventoryRestored: { $ne: true } },
      { $set: { inventoryRestored: true } },
    );
    if (finalized.modifiedCount !== 1) {
      const currentOrder = await Order.findOne({
        _id: order._id,
        paymentStatus: 'failed',
        inventoryRestored: true,
      }).lean();
      if (!currentOrder) {
        throw new Error(
          `No se pudo confirmar la restitución de inventario para la orden ${order._id}.`,
        );
      }
    }

    try {
      for (const item of itemsToRestore) {
        await Product.updateOne(
          { _id: item.product },
          { $pull: { inventoryRestorationKeys: `${order._id}:${item.product}` } },
        );
      }
      await Order.updateOne(
        { _id: order._id, paymentStatus: 'failed', inventoryRestored: true },
        { $set: { inventoryRestorationKeysPruned: true } },
      );
    } catch (cleanupError) {
      logger.error(
        `La orden ${order._id} fue restituida, pero no se pudieron limpiar sus claves de idempotencia: ${cleanupError.message}`,
        {
          stack: cleanupError.stack,
        },
      );
    }
    return true;
  } finally {
    await releaseProductLocks();
  }
};

const pruneCompletedInventoryRestorationKeys = async () => {
  const orders = await Order.find({
    paymentStatus: 'failed',
    inventoryRestored: true,
    inventoryRestorationKeysPruned: { $ne: true },
  })
    .sort({ createdAt: 1 })
    .limit(100);

  let prunedCount = 0;
  for (const order of orders) {
    const productIds = order.items
      .filter((item) => item.inventoryReserved)
      .map((item) => item.product);
    let releaseLocks;
    try {
      releaseLocks = await acquireProductReservationLocks(productIds);
      for (const productId of productIds) {
        await Product.updateOne(
          { _id: productId },
          { $pull: { inventoryRestorationKeys: `${order._id}:${productId}` } },
        );
      }
      const result = await Order.updateOne(
        { _id: order._id, paymentStatus: 'failed', inventoryRestored: true },
        { $set: { inventoryRestorationKeysPruned: true } },
      );
      if (result.modifiedCount === 1) prunedCount += 1;
    } catch (error) {
      logger.error(
        `No se pudieron limpiar las claves de idempotencia de la orden ${order._id}: ${error.message}`,
        {
          stack: error.stack,
        },
      );
    } finally {
      if (releaseLocks) await releaseLocks();
    }
  }
  return prunedCount;
};

const expirePendingWhatsappOrders = async () => {
  const now = new Date();
  const expiresBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const expiredOrders = await Order.find({
    paymentStatus: { $in: ['pending', 'failed'] },
    paymentMethod: 'whatsapp',
    createdAt: { $lte: expiresBefore },
    inventoryRestored: { $ne: true },
  })
    .sort({ createdAt: 1 })
    .limit(100);

  let expiredCount = 0;
  for (const order of expiredOrders) {
    try {
      if (await restoreOrderInventory(order._id)) expiredCount += 1;
    } catch (error) {
      logger.error(`No se pudo expirar la orden de WhatsApp ${order._id}: ${error.message}`, {
        stack: error.stack,
      });
    }
  }
  return expiredCount;
};

const markOrderAsPaid = async (orderId) => {
  let order = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: 'pending' },
    {
      $set: { paymentStatus: 'paid', status: 'processing' },
    },
    { returnDocument: 'after' },
  );

  if (!order) {
    order = await Order.findOne({ _id: orderId, paymentStatus: 'paid' });
  }

  if (!order) return null;

  await reconcileOrderCart(order);

  if (order?.couponReservationStatus === 'reserved') {
    await consumeCouponReservation(
      order.coupon,
      order._id,
      order.couponReservationManaged === undefined,
    );
    await Order.updateOne(
      { _id: order._id, couponReservationStatus: 'reserved' },
      { $set: { couponReservationStatus: 'redeemed' } },
    );
  }

  return order;
};

const reconcileOrderCart = async (order) => {
  if (!order.user || !order.cartSnapshotUpdatedAt) return;

  // Never clear cart changes made while the customer was completing payment.
  const cart = await Cart.findOne({ user: order.user }).select('items updatedAt').lean();
  if (!cart || cart.updatedAt?.getTime() !== order.cartSnapshotUpdatedAt.getTime()) return;

  const purchasedQuantities = new Map(
    order.items.map((item) => [item.product.toString(), item.quantity]),
  );
  const cartQuantities = new Map(
    cart.items.map((item) => [item.product.toString(), item.quantity]),
  );
  if (
    purchasedQuantities.size !== cartQuantities.size ||
    [...purchasedQuantities].some(
      ([productId, quantity]) => cartQuantities.get(productId) !== quantity,
    )
  ) {
    return;
  }

  await Cart.updateOne(
    { _id: cart._id, updatedAt: order.cartSnapshotUpdatedAt, items: cart.items },
    { $set: { items: [] } },
  );
};
// ==========================================
// CREAR ORDEN
// ==========================================

// @desc    Crear un pedido y preparar el mensaje de WhatsApp
// @route   POST /api/orders/checkout
// @access  Public (soporta invitados)
const createOrder = async (req, res, next) => {
  let newOrder;
  let reservedItems = [];
  let couponDiscount;
  let releaseStockLocks;
  try {
    const { items, guestInfo, shippingAddress, couponCode } = req.body;

    // ✅ FIX: Validar items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar al menos un item en la orden.',
      });
    }

    // ✅ FIX: Validar límite máximo de items por orden
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

    const phone = (process.env.WHATSAPP_BUSINESS_PHONE || '').replace(/\D/g, '');
    if (!/^\d{8,15}$/.test(phone)) {
      const error = new Error('WhatsApp no está configurado. Contacta con la tienda por otro medio.');
      error.statusCode = 503;
      throw error;
    }

    const buyerName = guestInfo?.name || req.session?.user?.name || 'Cliente';
    const buyerEmail = guestInfo?.email || req.session?.user?.email || 'No proporcionado';
    const productLines = orderItems
      .map((item) => `• ${item.productName} x${item.quantity} — $${(item.price * item.quantity).toFixed(2)}`)
      .join('\n');
    const message = [
      'Hola, quiero completar este pedido de TechStore:',
      `Pedido: ${newOrder._id}`,
      `Nombre: ${buyerName}`,
      `Correo: ${buyerEmail}`,
      productLines,
      `Subtotal: $${totalAmount.toFixed(2)}`,
      ...(discountAmount > 0 ? [`Descuento: -$${discountAmount.toFixed(2)}`] : []),
      `Total: $${finalAmount.toFixed(2)}`,
      'Por favor, confírmame disponibilidad y cómo finalizar la compra.',
    ].join('\n');
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    await newOrder.save();
    if (userId) await reconcileOrderCart(newOrder);

    logger.info(`Orden creada: ${newOrder._id} - Total: $${finalAmount.toFixed(2)}.`);

    res.status(201).json({
      success: true,
      orderId: newOrder._id,
      whatsappUrl,
    });
  } catch (error) {
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

// ==========================================
// HISTORIAL DE ÓRDENES
// ==========================================

// @desc    Obtener historial de órdenes del usuario
// @route   GET /api/orders
// @access  Private (requiere login)
const getUserOrders = async (req, res, next) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({
        success: false,
        error: 'Debes iniciar sesión para ver tus órdenes.',
      });
    }

    const orders = await Order.find({ user: req.session.user.id })
      .populate('items.product', 'name price image')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    logger.error(`Error al obtener órdenes del usuario: ${error.message}`, { stack: error.stack });
    next(error);
  }
};

// ==========================================
// ACTUALIZAR ESTADO DE ORDEN (Admin)
// ==========================================

// @desc    Actualizar el estado de una orden
// @route   PUT /api/orders/:id/status o /admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['processing', 'shipped', 'delivered', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error:
          'Estado no válido. Las órdenes pagadas pueden avanzar a procesamiento, envío, entrega o completada.',
      });
    }

    const currentOrder = await Order.findById(req.params.id).select('paymentStatus status');
    if (!currentOrder) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada.' });
    }
    if (currentOrder.paymentStatus !== 'paid') {
      return res.status(409).json({
        success: false,
        error: 'No se puede cambiar el estado de envío hasta confirmar el pago.',
      });
    }
    if (currentOrder.status === status) {
      return res
        .status(200)
        .json({ success: true, message: 'La orden ya tiene ese estado.', order: currentOrder });
    }

    const nextStatuses = {
      pending: ['processing'],
      processing: ['shipped'],
      shipped: ['delivered'],
      delivered: ['completed'],
      completed: [],
    };
    if (!nextStatuses[currentOrder.status]?.includes(status)) {
      return res.status(409).json({
        success: false,
        error: 'La orden solo puede avanzar al siguiente estado del flujo de envío.',
      });
    }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, paymentStatus: 'paid', status: currentOrder.status },
      { $set: { status } },
      { returnDocument: 'after' },
    );

    if (!order) {
      return res.status(409).json({
        success: false,
        error: 'La orden cambió mientras se actualizaba. Recarga e inténtalo de nuevo.',
      });
    }

    logger.info(`Estado de orden #${order._id} actualizado a: ${status}`);

    res.status(200).json({
      success: true,
      message: 'Estado de la orden actualizado correctamente.',
      order,
    });
  } catch (error) {
    logger.error(`Error al actualizar estado de orden: ${error.message}`, { stack: error.stack });
    next(error);
  }
};

const markWhatsappOrderPaid = async (req, res, next) => {
  try {
    const pendingOrder = await Order.findOne({
      _id: req.params.id,
      paymentMethod: 'whatsapp',
      paymentStatus: 'pending',
      status: 'pending',
    });
    if (!pendingOrder) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró un pedido de WhatsApp pendiente.',
      });
    }

    const order = await markOrderAsPaid(pendingOrder._id);
    if (!order) {
      return res.status(409).json({
        success: false,
        error: 'El pedido cambió mientras se confirmaba. Actualiza la página.',
      });
    }

    logger.info(`Pago confirmado manualmente para pedido de WhatsApp ${order._id}.`);
    return res.json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  markWhatsappOrderPaid,
  expirePendingWhatsappOrders,
  pruneCompletedInventoryRestorationKeys,
  getUserOrders,
  updateOrderStatus,
};

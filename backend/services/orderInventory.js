const Order = require('../models/Order');
const Product = require('../models/Product');
const logger = require('../config/logger');
const { releaseCouponReservation } = require('./couponService');
const { acquireProductReservationLocks } = require('./productReservationLock');
const { orderEvent } = require('./orderAudit');

const restoreOrderInventory = async (orderId, items, reason = 'checkout_failed', actor) => {
  let order = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: 'pending', inventoryRestored: { $ne: true } },
    {
      $set: { paymentStatus: 'failed', status: 'cancelled', checkoutState: 'failed' },
      $push: { events: orderEvent(reason, actor) },
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
      if (await restoreOrderInventory(order._id, undefined, 'expired')) expiredCount += 1;
    } catch (error) {
      logger.error(`No se pudo expirar la orden de WhatsApp ${order._id}: ${error.message}`, {
        stack: error.stack,
      });
    }
  }
  return expiredCount;
};

module.exports = {
  restoreOrderInventory,
  pruneCompletedInventoryRestorationKeys,
  expirePendingWhatsappOrders,
};

const Order = require('../models/Order');
const Product = require('../models/Product');
const logger = require('../config/logger');
const { releaseCouponReservation } = require('./couponService');
const { acquireProductReservationLocks } = require('./productReservationLock');
const { orderEvent } = require('./orderAudit');
const { withInventoryTransaction, inSession } = require('./inventoryTransaction');

const restoreOrderInventory = async (orderId, items, reason = 'checkout_failed', actor) => {
  const initial = await Order.findOne({ _id: orderId, paymentStatus: { $in: ['pending', 'failed'] }, inventoryRestored: { $ne: true } });
  if (!initial) return false;
  const itemsToRestore = items || initial.items.filter((item) => item.inventoryReserved);
  const lease = await acquireProductReservationLocks(itemsToRestore.map((item) => item.product));
  let completed;
  try {
    completed = await withInventoryTransaction(async (session) => {
      const order = await Order.findOneAndUpdate(
        { _id: orderId, paymentStatus: { $in: ['pending', 'failed'] }, inventoryRestored: { $ne: true } },
        { $set: { paymentStatus: 'failed', status: 'cancelled', checkoutState: 'failed' }, $push: { events: orderEvent(reason, actor) } },
        { returnDocument: 'after', ...(session ? { session } : {}) });
      if (!order) return false;
      for (const item of itemsToRestore) {
        const key = `${order._id}:${item.product}`;
        const result = await Product.updateOne(
          { _id: item.product, inventoryRestorationKeys: { $ne: key } },
          { $inc: { stock: item.quantity }, $addToSet: { inventoryRestorationKeys: key } },
          session ? { session } : {});
        if (result.modifiedCount !== 1) {
          const product = await inSession(Product.findById(item.product), session).lean();
          if (!product) {
            await Order.updateOne({ _id: orderId }, { $push: { events: { ...orderEvent('inventory_product_missing', actor), product: item.product } } }, session ? { session } : {});
          } else if (!(await inSession(Product.exists({ _id: item.product, inventoryRestorationKeys: key }), session))) {
            throw new Error('No se pudo restituir el inventario del pedido.');
          }
        }
      }
      if (order.couponReservationStatus === 'reserved' && order.coupon) {
        await releaseCouponReservation(order.coupon, order._id, order.couponReservationManaged === undefined, { session });
        await Order.updateOne({ _id: orderId, couponReservationStatus: 'reserved' }, { $set: { couponReservationStatus: 'released' } }, session ? { session } : {});
      }
      await Order.updateOne({ _id: orderId }, { $set: { inventoryRestored: true } }, session ? { session } : {});
      return true;
    }, { lease });
    if (completed) {
      try {
        for (const item of itemsToRestore) await Product.updateOne({ _id: item.product }, { $pull: { inventoryRestorationKeys: `${orderId}:${item.product}` } });
        await Order.updateOne({ _id: orderId, inventoryRestored: true }, { $set: { inventoryRestorationKeysPruned: true } });
      } catch (error) { logger.error('No se pudieron limpiar marcadores de restitución.', { errorCode: error.code || error.name }); }
    }
    return completed;
  } finally { await lease.release(); }
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
      if (releaseLocks) await releaseLocks.release();
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

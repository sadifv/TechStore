const Order = require('../models/Order');
const Cart = require('../models/Cart');
const { consumeCouponReservation } = require('./couponService');
const { orderEvent } = require('./orderAudit');

const markOrderAsPaid = async (orderId, actor) => {
  let order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentMethod: 'whatsapp',
      paymentStatus: 'pending',
      createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    {
      $set: {
        paymentStatus: 'paid',
        status: 'processing',
        paymentConfirmedAt: new Date(),
        paymentConfirmedBy: actor,
      },
      $push: { events: orderEvent('payment_confirmed', actor) },
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
module.exports = { markOrderAsPaid, reconcileOrderCart };

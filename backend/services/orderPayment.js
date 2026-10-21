const Order = require('../models/Order');
const Cart = require('../models/Cart');
const { consumeCouponReservation } = require('./couponService');
const { orderEvent } = require('./orderAudit');
const { withInventoryTransaction, inSession } = require('./inventoryTransaction');

const markOrderAsPaid = async (orderId, actor) => {
  return withInventoryTransaction(async (session) => {
    let order = await Order.findOneAndUpdate(
      { _id: orderId, paymentMethod: 'whatsapp', paymentStatus: 'pending', checkoutState: { $ne: 'creating' },
        createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      { $set: { paymentStatus: 'paid', status: 'processing', paymentConfirmedAt: new Date(), paymentConfirmedBy: actor },
        $push: { events: orderEvent('payment_confirmed', actor) } },
      { returnDocument: 'after', ...(session ? { session } : {}) });
    if (!order) order = await inSession(Order.findOne({ _id: orderId, paymentStatus: 'paid' }), session);
    if (!order) return null;
    await reconcileOrderCart(order, { session });
    if (order.couponReservationStatus === 'reserved') {
      await consumeCouponReservation(order.coupon, order._id, order.couponReservationManaged === undefined, { session });
      await Order.updateOne({ _id: order._id, couponReservationStatus: 'reserved' }, { $set: { couponReservationStatus: 'redeemed' } }, session ? { session } : {});
    }
    return order;
  });
};

const reconcileOrderCart = async (order, { session } = {}) => {
  if (!order.user || !order.cartSnapshotUpdatedAt) return;

  // Never clear cart changes made while the customer was completing payment.
  const cart = await inSession(Cart.findOne({ user: order.user }).select('items updatedAt'), session).lean();
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
    session ? { session } : {},
  );
};
module.exports = { markOrderAsPaid, reconcileOrderCart };

const Order = require('../models/Order');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const Cart = require('../models/Cart');
const { getCouponDiscount, reserveCoupon } = require('./couponService');
const { acquireProductReservationLocks } = require('./productReservationLock');
const { withInventoryTransaction, inSession } = require('./inventoryTransaction');
const { getEffectivePrice } = require('./productPricing');
const { isProductArchived } = require('./productAvailability');
const { orderEvent } = require('./orderAudit');
const { reconcileOrderCart } = require('./orderPayment');
const invalid = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

async function createCheckout({ items, userId, guestInfo, shippingAddress, couponCode, checkoutKey, checkoutRequestHash }) {
  const lease = await acquireProductReservationLocks(items.map((item) => item.productId));
  try {
    return await withInventoryTransaction(async (session) => {
      if (checkoutKey) {
        const existing = await inSession(Order.findOne({ checkoutKey }), session);
        if (existing) return { order: existing, created: false };
      }
      const now = new Date();
      const orderItems = [];
      const otherReservations = new Map();
      let subtotal = 0;
      for (const { productId, quantity } of items) {
        const product = await inSession(Product.findById(productId), session).lean();
        if (!product || isProductArchived(product)) throw invalid('Producto no disponible.');
        const reserved = await Reservation.getReservedStock(product._id, { session });
        const own = userId ? await inSession(Reservation.findOne({ user: userId, product: product._id, status: 'active', expiresAt: { $gt: now } }), session).lean() : null;
        const other = Math.max(0, reserved - (own?.quantity || 0));
        if (product.stock - other < quantity) throw invalid(`Stock insuficiente para "${product.name}".`, 409);
        const price = getEffectivePrice(product, now.getTime());
        subtotal += price * quantity;
        otherReservations.set(String(product._id), other);
        orderItems.push({ product: product._id, productName: product.name, price, quantity, inventoryReserved: false });
      }
      subtotal = Number(subtotal.toFixed(2));
      const discount = couponCode ? await getCouponDiscount({ code: couponCode, subtotal }, { session }) : null;
      let cartSnapshotUpdatedAt;
      if (userId) {
        const cart = await inSession(Cart.findOne({ user: userId }).select('items updatedAt'), session).lean();
        const quantities = new Map((cart?.items || []).map((item) => [String(item.product), item.quantity]));
        if (cart?.updatedAt && quantities.size === orderItems.length && orderItems.every((item) => quantities.get(String(item.product)) === item.quantity)) cartSnapshotUpdatedAt = cart.updatedAt;
      }
      const discountAmount = discount?.discountAmount || 0;
      const [order] = await Order.create([{
        checkoutKey, checkoutRequestHash, checkoutState: 'creating',
        events: [orderEvent('created', userId)], items: orderItems,
        subtotalAmount: subtotal, totalAmount: Number((subtotal - discountAmount).toFixed(2)), discountAmount,
        coupon: discount?.coupon._id, couponCode: discount?.coupon.code,
        couponReservationStatus: discount ? 'reserved' : 'none', couponReservationManaged: discount ? true : undefined,
        paymentStatus: 'pending', status: 'pending', paymentMethod: 'whatsapp',
        cartSnapshotUpdatedAt, inventoryRestored: false, ...(userId ? { user: userId } : { guestInfo }), ...(shippingAddress ? { shippingAddress } : {}),
      }], session ? { session } : {});
      if (discount) await reserveCoupon(discount.coupon, order._id, { session });
      for (const [index, item] of orderItems.entries()) {
        const result = await Product.updateOne(
          { _id: item.product, archivedAt: null, stock: { $gte: item.quantity + otherReservations.get(String(item.product)) } },
          { $inc: { stock: -item.quantity } }, session ? { session } : {});
        if (result.modifiedCount !== 1) throw invalid('El stock cambió. Actualiza el carrito.', 409);
        order.items[index].inventoryReserved = true;
      }
      if (userId) await Reservation.updateMany({ user: userId, product: { $in: orderItems.map((item) => item.product) }, status: 'active' }, { $set: { status: 'completed' } }, session ? { session } : {});
      order.checkoutState = 'ready';
      await order.save(session ? { session } : {});
      await reconcileOrderCart(order, { session });
      return { order, created: true };
    }, { lease });
  } finally { await lease.release(); }
}
module.exports = { createCheckout };

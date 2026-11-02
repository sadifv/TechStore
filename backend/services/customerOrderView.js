const COMMERCIAL_EVENTS = new Set([
  'contact_confirmed',
  'payment_confirmed',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'customer_cancelled',
  'expired',
]);
const customerCancelConditions = (now = Date.now()) => ({
  paymentMethod: 'whatsapp',
  paymentStatus: 'pending',
  status: 'pending',
  checkoutState: 'ready',
  createdAt: { $gt: new Date(now - 24 * 60 * 60 * 1000) },
});

function customerOrderView(order) {
  const createdAt = new Date(order.createdAt);
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
  const expired =
    order.paymentStatus !== 'paid' &&
    ((order.events || []).some((event) => event.type === 'expired') ||
      (order.status !== 'cancelled' && expiresAt <= new Date()));
  return {
    _id: String(order._id),
    createdAt,
    expiresAt,
    expired,
    totalAmount: order.totalAmount,
    subtotalAmount: order.subtotalAmount,
    discountAmount: order.discountAmount,
    couponCode: order.couponCode,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    contactConfirmed: Boolean(order.contactConfirmedAt),
    contactConfirmedAt: order.contactConfirmedAt,
    paymentConfirmedAt: order.paymentConfirmedAt,
    guestOrder: !order.user,
    shippingAddressProvided: order.shippingAddressProvided === true,
    ...(order.shippingAddressProvided === true
      ? {
          shippingAddress: {
            recipient: order.shippingAddress?.recipient,
            street: order.shippingAddress?.street,
            city: order.shippingAddress?.city,
            country: order.shippingAddress?.country,
            reference: order.shippingAddress?.reference,
          },
        }
      : {}),
    canCancel:
      order.paymentMethod === 'whatsapp' &&
      order.paymentStatus === 'pending' &&
      order.status === 'pending' &&
      order.checkoutState === 'ready' &&
      !expired,
    items: (order.items || []).map((item) => ({
      productId: item.product ? String(item.product._id || item.product) : null,
      productName: item.productName || item.product?.name || 'Producto',
      price: item.price,
      quantity: item.quantity,
    })),
    events: (order.events || [])
      .filter((event) => COMMERCIAL_EVENTS.has(event.type))
      .map((event) => ({ type: event.type, at: event.at })),
  };
}
module.exports = { customerOrderView, customerCancelConditions };

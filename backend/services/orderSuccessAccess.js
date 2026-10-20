const crypto = require('node:crypto');

const isOrderSuccessAccessible = ({ order, userId, checkoutKey }) => {
  if (!order) return false;
  if (order.user) return Boolean(userId && String(order.user) === String(userId));
  if (typeof checkoutKey !== 'string') return false;
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(checkoutKey)) return false;

  const hashedCheckoutKey = crypto
    .createHash('sha256')
    .update(`guest:${checkoutKey}`)
    .digest('hex');
  return order.checkoutKey === hashedCheckoutKey;
};

module.exports = { isOrderSuccessAccessible };

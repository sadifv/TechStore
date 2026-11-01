const test = require('node:test');
const assert = require('node:assert/strict');
test('maintenance expiry remains distinguishable from customer cancellation', () => {
  assert.equal(
    customerOrderView({
      ...base(),
      paymentStatus: 'failed',
      status: 'cancelled',
      events: [{ type: 'expired', at: new Date() }],
    }).expired,
    true,
  );
  assert.equal(
    customerOrderView({
      ...base(),
      paymentStatus: 'failed',
      status: 'cancelled',
      createdAt: new Date(0),
      events: [{ type: 'customer_cancelled', at: new Date() }],
    }).expired,
    false,
  );
});
const { customerOrderView, customerCancelConditions } = require('../services/customerOrderView');

const base = () => ({
  _id: 'abc',
  user: 'owner',
  paymentMethod: 'whatsapp',
  paymentStatus: 'pending',
  status: 'pending',
  checkoutState: 'ready',
  createdAt: new Date(),
  totalAmount: 30,
  items: [{ product: 'product-id', productName: 'Nombre histórico', price: 15, quantity: 2 }],
  checkoutKey: 'secret',
  checkoutRequestHash: 'secret',
  guestInfo: { email: 'private' },
  events: [
    { type: 'payment_confirmed', actor: 'admin-private', at: new Date() },
    { type: 'inventory_product_missing', product: 'private', at: new Date() },
  ],
});

test('customer view exposes historical amounts and commercial events without internal fields', () => {
  const result = customerOrderView(base());
  assert.equal(result.items[0].productName, 'Nombre histórico');
  assert.equal(result.items[0].productId, 'product-id');
  assert.equal(result.totalAmount, 30);
  assert.equal(result.canCancel, true);
  assert.equal(result.events.length, 1);
  assert.deepEqual(Object.keys(result.events[0]).sort(), ['at', 'type']);
  for (const key of ['checkoutKey', 'checkoutRequestHash', 'guestInfo', 'user'])
    assert.equal(key in result, false);
});

test('paid, expired, cancelled and creating orders cannot offer customer cancellation', () => {
  for (const changes of [
    { paymentStatus: 'paid' },
    { status: 'cancelled' },
    { createdAt: new Date(0) },
    { checkoutState: 'creating' },
    { checkoutState: 'failed' },
    { paymentStatus: 'failed' },
    { status: 'shipped' },
  ]) {
    assert.equal(customerOrderView({ ...base(), ...changes }).canCancel, false);
  }
  assert.equal(
    customerOrderView({ ...base(), paymentStatus: 'paid', createdAt: new Date(0) }).expired,
    false,
  );
  assert.equal(customerCancelConditions().checkoutState, 'ready');
});

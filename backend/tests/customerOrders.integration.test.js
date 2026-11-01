const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const enabled = process.env.TECHSTORE_INTEGRATION === '1';
test(
  'tracking and cancellation preserve product names for legacy orders without snapshots',
  { skip: !enabled },
  async () => {
    const { order } = await fixture();
    await require('../models/Order').updateOne(
      { _id: order._id },
      { $unset: { 'items.0.productName': 1 } },
    );
    assert.equal(
      (await response('/track', { orderId: order.id })).body.data.items[0].productName,
      'Actual',
    );
    assert.equal(
      (await response('/cancel', { orderId: order.id })).body.data.items[0].productName,
      'Actual',
    );
  },
);
test(
  'HTTP cancellation rolls back after coupon failure and permits a safe retry',
  { skip: !enabled },
  async () => {
    const Coupon = require('../models/Coupon');
    const Product = require('../models/Product');
    const Order = require('../models/Order');
    const coupon = await Coupon.create({
      code: 'ROLLBACKCUSTOMER',
      discountPercent: 10,
      redemptionCount: 1,
      minOrderAmount: 0,
      maxDiscountAmount: 10,
    });
    const { order, product } = await fixture({
      coupon: coupon._id,
      couponReservationStatus: 'reserved',
      couponReservationManaged: true,
    });
    await Coupon.updateOne({ _id: coupon._id }, { $addToSet: { reservationOrderIds: order._id } });
    const original = Coupon.updateOne;
    Coupon.updateOne = function (filter, update, ...args) {
      if (update.$inc?.redemptionCount === -1) throw new Error('Injected coupon failure');
      return original.call(this, filter, update, ...args);
    };
    try {
      assert.equal((await response('/cancel', { orderId: order.id })).status, 500);
    } finally {
      Coupon.updateOne = original;
    }
    assert.equal((await Product.findById(product._id)).stock, 2);
    assert.equal((await Order.findById(order._id)).status, 'pending');
    assert.equal((await Order.findById(order._id)).events.length, 0);
    assert.equal((await Coupon.findById(coupon._id)).redemptionCount, 1);
    assert.equal((await response('/cancel', { orderId: order.id })).status, 200);
    assert.equal((await Product.findById(product._id)).stock, 3);
  },
);
let replica, server, base, user, other;
const key = '11111111-1111-4111-8111-111111111111';
const response = async (route, body, identity = user) => {
  const r = await fetch(base + route, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(identity ? { 'x-test-user': String(identity._id) } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json(), cache: r.headers.get('cache-control') };
};
test.before(async () => {
  if (!enabled) return;
  replica = await startLocalReplicaSet();
  await mongoose.connect(replica.uri);
  const User = require('../models/User');
  for (const model of ['User', 'Product', 'Order', 'Coupon', 'MaintenanceLock'])
    await require(`../models/${model}`).init();
  [user, other] = await User.create([
    { name: 'Cliente', email: 'client@example.invalid', password: 'test-password-123' },
    { name: 'Otro', email: 'other@example.invalid', password: 'test-password-456' },
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = req.headers['x-test-user']
      ? { user: { id: req.headers['x-test-user'], authVersion: 0 } }
      : {};
    next();
  });
  app.use('/api/orders', require('../routes/orderRoutes'));
  app.use((error, req, res, next) =>
    res.status(error.statusCode || 500).json({ success: false, error: error.message }),
  );
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/orders`;
});
test.after(async () => {
  if (!enabled) return;
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await replica?.stop();
});
async function fixture(extra = {}) {
  const Product = require('../models/Product');
  const Order = require('../models/Order');
  const product = await Product.create({ name: 'Actual', price: 12, stock: 2 });
  const order = await Order.create({
    user: user._id,
    paymentMethod: 'whatsapp',
    checkoutState: 'ready',
    items: [
      {
        product: product._id,
        productName: 'Histórico',
        price: 10,
        quantity: 1,
        inventoryReserved: true,
      },
    ],
    totalAmount: 10,
    ...extra,
  });
  return { product, order };
}
test(
  'HTTP customer tracking enforces ownership and guest capability and returns only public data',
  { skip: !enabled },
  async () => {
    const { order } = await fixture();
    const good = await response('/track', { orderId: order.id });
    assert.equal(good.status, 200);
    assert.match(good.cache, /no-store/);
    assert.equal(good.body.data.items[0].productName, 'Histórico');
    assert.equal('checkoutKey' in good.body.data, false);
    for (const identity of [null, other])
      assert.equal((await response('/track', { orderId: order.id }, identity)).status, 404);
    assert.equal((await response('/track', { orderId: '../invalid' })).status, 400);
    const guest = await fixture({
      user: undefined,
      checkoutKey: crypto.createHash('sha256').update(`guest:${key}`).digest('hex'),
    });
    assert.equal((await response('/track', { orderId: guest.order.id }, null)).status, 404);
    assert.equal(
      (await response('/track', { orderId: guest.order.id, checkoutKey: key }, null)).status,
      200,
    );
  },
);
test(
  'customer cancellation releases stock and coupon once and rejects foreign, paid and creating orders',
  { skip: !enabled },
  async () => {
    const Coupon = require('../models/Coupon');
    const Product = require('../models/Product');
    const Order = require('../models/Order');
    const coupon = await Coupon.create({
      code: 'CUSTOMER',
      discountPercent: 10,
      redemptionCount: 1,
      minOrderAmount: 0,
      maxDiscountAmount: 10,
    });
    const { order, product } = await fixture({
      coupon: coupon._id,
      couponReservationStatus: 'reserved',
      couponReservationManaged: true,
    });
    await Coupon.updateOne({ _id: coupon._id }, { $addToSet: { reservationOrderIds: order._id } });
    assert.equal((await response('/cancel', { orderId: order.id }, other)).status, 404);
    const results = await Promise.all([
      response('/cancel', { orderId: order.id }),
      response('/cancel', { orderId: order.id }),
    ]);
    assert.ok(results.every((r) => r.status === 200));
    assert.equal((await Product.findById(product._id)).stock, 3);
    assert.equal((await Coupon.findById(coupon._id)).redemptionCount, 0);
    assert.equal(
      (await Order.findById(order._id)).events.filter((e) => e.type === 'customer_cancelled')
        .length,
      1,
    );
    for (const changes of [
      { paymentStatus: 'paid' },
      { checkoutState: 'creating' },
      { createdAt: new Date(0) },
    ]) {
      const f = await fixture(changes);
      assert.equal((await response('/cancel', { orderId: f.order.id })).status, 409);
      assert.equal((await Product.findById(f.product._id)).stock, 2);
    }
  },
);
test(
  'guest cancellation requires its private key and payment racing cancellation has one coherent outcome',
  { skip: !enabled },
  async () => {
    const Product = require('../models/Product');
    const Order = require('../models/Order');
    const guestKey = crypto.randomUUID();
    const guest = await fixture({
      user: undefined,
      checkoutKey: crypto.createHash('sha256').update(`guest:${guestKey}`).digest('hex'),
    });
    assert.equal(
      (
        await response(
          '/cancel',
          { orderId: guest.order.id, checkoutKey: crypto.randomUUID() },
          null,
        )
      ).status,
      404,
    );
    assert.equal(
      (await response('/cancel', { orderId: guest.order.id, checkoutKey: guestKey }, null)).status,
      200,
    );
    const { order, product } = await fixture();
    await Promise.allSettled([
      response('/cancel', { orderId: order.id }),
      require('../services/orderPayment').markOrderAsPaid(order.id, other._id),
    ]);
    const current = await Order.findById(order._id);
    const stock = (await Product.findById(product._id)).stock;
    assert.ok(
      (current.paymentStatus === 'paid' && stock === 2 && !current.inventoryRestored) ||
        (current.status === 'cancelled' && stock === 3 && current.inventoryRestored),
    );
  },
);

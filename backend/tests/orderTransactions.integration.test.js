const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const enabled = process.env.TECHSTORE_INTEGRATION === '1';
if (enabled) process.env.WHATSAPP_BUSINESS_PHONE = '593999999999';
let replica;
test.before(async () => {
  if (!enabled) return;
  replica = await startLocalReplicaSet();
  await mongoose.connect(replica.uri);
  for (const name of ['Product', 'Order', 'Cart', 'Coupon', 'Reservation', 'MaintenanceLock', 'User']) await require(`../models/${name}`).init();
});

async function checkout(body) {
  const { createOrder } = require('../controllers/orderCheckoutController');
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await createOrder({ body }, res, (error) => { throw error; });
  return res;
}
test('checkout rollback leaves no partial order, stock change or coupon reservation', { skip: !enabled }, async () => {
  process.env.WHATSAPP_BUSINESS_PHONE = '593999999999';
  const Product = require('../models/Product'); const Order = require('../models/Order'); const Coupon = require('../models/Coupon');
  const product = await Product.create({ name: 'Rollback', price: 10, stock: 5 });
  const coupon = await Coupon.create({ code: 'ROLLBACK', discountPercent: 10, minOrderAmount: 0, maxDiscountAmount: 5 });
  const originalSave = Order.prototype.save;
  Order.prototype.save = async function (...args) {
    if (this.items.some((item) => item.inventoryReserved)) throw new Error('injected after inventory write');
    return originalSave.apply(this, args);
  };
  try {
    await assert.rejects(checkout({ items: [{ productId: String(product._id), quantity: 1 }], guestInfo: { name: 'Test', email: 'test@example.invalid' }, couponCode: coupon.code }), /injected/);
  } finally { Order.prototype.save = originalSave; }
  assert.equal((await Product.findById(product._id)).stock, 5);
  assert.equal((await Coupon.findById(coupon._id)).redemptionCount, 0);
  assert.equal(await Order.countDocuments(), 0);
});
test.after(async () => { if (enabled) { await mongoose.disconnect(); await replica?.stop(); } });
test('real Mongo transaction rolls back two collections after an interrupted operation', { skip: !enabled }, async () => {
  const { withInventoryTransaction } = require('../services/inventoryTransaction');
  const a = mongoose.connection.collection('test_a'); const b = mongoose.connection.collection('test_b');
  await a.insertOne({ value: 1 }); await b.insertOne({ value: 1 });
  await assert.rejects(withInventoryTransaction(async (session) => {
    await a.updateOne({}, { $inc: { value: -1 } }, { session });
    await b.updateOne({}, { $inc: { value: 1 } }, { session });
    throw new Error('interrupted');
  }), /interrupted/);
  assert.equal((await a.findOne()).value, 1); assert.equal((await b.findOne()).value, 1);
});

test('cancel failure rolls back stock, order status and coupon together', { skip: !enabled }, async () => {
  const Product = require('../models/Product'); const Order = require('../models/Order'); const Coupon = require('../models/Coupon');
  const product = await Product.create({ name: 'Cancel rollback', price: 10, stock: 3 });
  const coupon = await Coupon.create({ code: 'CANCEL', discountPercent: 10, minOrderAmount: 0, maxDiscountAmount: 5, redemptionCount: 1 });
  const order = await Order.create({ items: [{ product: product._id, quantity: 2, price: 10, inventoryReserved: true }], totalAmount: 18, coupon: coupon._id, couponReservationStatus: 'reserved', couponReservationManaged: true });
  await Coupon.updateOne({ _id: coupon._id }, { $addToSet: { reservationOrderIds: order._id } });
  const original = Coupon.updateOne;
  Coupon.updateOne = function (filter, update, ...args) {
    if (update.$inc?.redemptionCount === -1) throw new Error('coupon interruption');
    return original.call(this, filter, update, ...args);
  };
  try { await assert.rejects(require('../services/orderInventory').restoreOrderInventory(order._id), /coupon interruption/); }
  finally { Coupon.updateOne = original; }
  assert.equal((await Product.findById(product._id)).stock, 3);
  assert.equal((await Order.findById(order._id)).paymentStatus, 'pending');
  assert.equal((await Coupon.findById(coupon._id)).redemptionCount, 1);
});

test('simultaneous idempotent checkouts deduct stock once and preserve expired-sale snapshot', { skip: !enabled }, async () => {
  const Product = require('../models/Product'); const Order = require('../models/Order');
  const p = await Product.create({ name: 'Idempotent', stock: 2, price: 5, originalPrice: 10, flashSale: true, flashSaleEndsAt: new Date(Date.now() - 1000) });
  const body = { checkoutKey: '11111111-1111-4111-8111-111111111111', items: [{ productId: String(p._id), quantity: 1 }], guestInfo: { name: 'Test', email: 'test@example.invalid' } };
  const results = await Promise.all([checkout(body), checkout(body)]);
  assert.ok(results.every((r) => r.statusCode < 300));
  assert.equal(String(results[0].body.orderId), String(results[1].body.orderId));
  assert.equal((await Product.findById(p._id)).stock, 1);
  const order = await Order.findById(results[0].body.orderId);
  assert.equal(order.items[0].price, 10);
  await Product.updateOne({ _id: p._id }, { $set: { price: 20, flashSale: false } });
  assert.equal((await checkout(body)).body.whatsappUrl, results[0].body.whatsappUrl);
  const collision = await checkout({ ...body, items: [{ productId: String(p._id), quantity: 2 }] });
  assert.equal(collision.statusCode, 409);
});
test('competing checkouts cannot sell the last unit twice', { skip: !enabled }, async () => {
  const Product = require('../models/Product');
  const p = await Product.create({ name: 'Last unit', stock: 1, price: 10 });
  const body = { items: [{ productId: String(p._id), quantity: 1 }], guestInfo: { name: 'Test', email: 'test@example.invalid' } };
  const results = await Promise.all([checkout(body), checkout(body)]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [201, 409]);
  assert.equal((await Product.findById(p._id)).stock, 0);
});
test('cancel archived and missing product restores others and releases coupon once', { skip: !enabled }, async () => {
  const Product = require('../models/Product'); const Order = require('../models/Order'); const Coupon = require('../models/Coupon');
  const p = await Product.create({ name: 'Archived', stock: 3, price: 10, archivedAt: new Date() });
  const missing = new mongoose.Types.ObjectId();
  const coupon = await Coupon.create({ code: 'ARCHIVED', discountPercent: 10, minOrderAmount: 0, maxDiscountAmount: 5, redemptionCount: 1 });
  const order = await Order.create({ items: [{ product: p._id, quantity: 2, price: 10, inventoryReserved: true }, { product: missing, quantity: 1, price: 1, inventoryReserved: true }], totalAmount: 20, coupon: coupon._id, couponReservationStatus: 'reserved', couponReservationManaged: true });
  await Coupon.updateOne({ _id: coupon._id }, { $addToSet: { reservationOrderIds: order._id } });
  const restore = require('../services/orderInventory').restoreOrderInventory;
  assert.equal(await restore(order._id), true); assert.equal(await restore(order._id), false);
  assert.equal((await Product.findById(p._id)).stock, 5);
  assert.equal((await Coupon.findById(coupon._id)).redemptionCount, 0);
  const saved = await Order.findById(order._id);
  assert.equal(saved.inventoryRestored, true);
  assert.ok(saved.events.some((e) => e.type === 'inventory_product_missing' && String(e.product) === String(missing)));
  assert.equal((await checkout({ items: [{ productId: String(p._id), quantity: 1 }], guestInfo: { name: 'Test', email: 'test@example.invalid' } })).statusCode, 400);
});
test('legacy restoration marker prevents a second stock increment', { skip: !enabled }, async () => {
  const Product = require('../models/Product'); const Order = require('../models/Order');
  const p = await Product.create({ name: 'Legacy restored', price: 10, stock: 5 });
  const order = await Order.create({ items: [{ product: p._id, quantity: 2, price: 10, inventoryReserved: true }], totalAmount: 20 });
  await Product.updateOne({ _id: p._id }, { $addToSet: { inventoryRestorationKeys: `${order._id}:${p._id}` } });
  await require('../services/orderInventory').restoreOrderInventory(order._id);
  assert.equal((await Product.findById(p._id)).stock, 5);
  assert.equal((await Order.findById(order._id)).inventoryRestored, true);
});
test('payment and cancellation race has a single consistent outcome', { skip: !enabled }, async () => {
  const Product = require('../models/Product'); const Order = require('../models/Order');
  const p = await Product.create({ name: 'Payment race', price: 10, stock: 3 });
  const order = await Order.create({ items: [{ product: p._id, quantity: 2, price: 10, inventoryReserved: true }], totalAmount: 20, checkoutState: 'ready' });
  await Promise.all([require('../services/orderPayment').markOrderAsPaid(order._id), require('../services/orderInventory').restoreOrderInventory(order._id)]);
  const saved = await Order.findById(order._id); const product = await Product.findById(p._id);
  if (saved.paymentStatus === 'paid') { assert.equal(product.stock, 3); assert.equal(saved.inventoryRestored, false); }
  else { assert.equal(saved.paymentStatus, 'failed'); assert.equal(product.stock, 5); assert.equal(saved.inventoryRestored, true); }
});
test('lease guard rejects a stolen token and cannot delete the new owner', { skip: !enabled }, async () => {
  const Lock = require('../models/MaintenanceLock');
  const lease = await require('../services/productReservationLock').acquireProductReservationLocks(['stolen']);
  await Lock.updateOne({ _id: 'product-reservation:stolen' }, { $set: { ownerToken: 'new-owner' } });
  await assert.rejects(lease.assertOwned(), /stock/); await lease.release();
  assert.equal((await Lock.findById('product-reservation:stolen')).ownerToken, 'new-owner');
});
test('cart reservations and checkout share atomic availability and keep newer cart edits', { skip: !enabled }, async (t) => {
  const Product = require('../models/Product'); const User = require('../models/User'); const Cart = require('../models/Cart'); const Reservation = require('../models/Reservation');
  const user = await User.create({ name: 'Test account', email: 'cart@example.invalid', password: 'test-password-long' });
  const p = await Product.create({ name: 'Reserved item', price: 5, originalPrice: 10, flashSale: true, flashSaleEndsAt: new Date(0), stock: 2 });
  const express = require('express'); const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.session = { user: { id: String(user._id), authVersion: 0 } }; next(); });
  app.use('/cart', require('../routes/cartRoutes'));
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/cart`;
  const response = await fetch(url + '/add', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ productId: String(p._id), quantity: 1 }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).items[0].product.price, 10);
  assert.equal(await Reservation.getReservedStock(p._id), 1);
  const other = new mongoose.Types.ObjectId();
  await Reservation.create({ user: other, product: p._id, quantity: 1, status: 'active', expiresAt: new Date(Date.now() + 60000) });
  assert.equal((await checkout({ items: [{ productId: String(p._id), quantity: 1 }], guestInfo: { name: 'Test', email: 'test@example.invalid' } })).statusCode, 409);
  const { createCheckout } = require('../services/checkoutService');
  const result = await createCheckout({ items: [{ productId: String(p._id), quantity: 1 }], userId: user._id });
  assert.equal(result.created, true); assert.equal((await Product.findById(p._id)).stock, 1);
  assert.equal((await Cart.findOne({ user: user._id })).items.length, 0);
  assert.equal(await Reservation.getReservedStock(p._id), 1);
});

test('payment failure cannot leave a paid order with a reserved coupon', { skip: !enabled }, async () => {
  const Product = require('../models/Product'); const Order = require('../models/Order'); const Coupon = require('../models/Coupon');
  const p = await Product.create({ name: 'Paid rollback', stock: 3, price: 10 });
  const coupon = await Coupon.create({ code: 'PAYROLLBACK', discountPercent: 10, minOrderAmount: 0, maxDiscountAmount: 5, redemptionCount: 1 });
  const order = await Order.create({ items: [{ product: p._id, quantity: 1, price: 10, inventoryReserved: true }], totalAmount: 9, checkoutState: 'ready', coupon: coupon._id, couponReservationStatus: 'reserved', couponReservationManaged: true });
  await Coupon.updateOne({ _id: coupon._id }, { $addToSet: { reservationOrderIds: order._id } });
  const original = Coupon.updateOne;
  Coupon.updateOne = function (filter, update, ...args) {
    if (update.$pull?.reservationOrderIds) throw new Error('payment interrupted');
    return original.call(this, filter, update, ...args);
  };
  try { await assert.rejects(require('../services/orderPayment').markOrderAsPaid(order._id), /payment interrupted/); }
  finally { Coupon.updateOne = original; }
  assert.equal((await Order.findById(order._id)).paymentStatus, 'pending');
  assert.equal((await Coupon.findById(coupon._id).select('+reservationOrderIds')).reservationOrderIds.length, 1);
});
test('concurrent checkouts cannot consume the last coupon use twice', { skip: !enabled }, async () => {
  const Product = require('../models/Product'); const Coupon = require('../models/Coupon');
  const products = await Product.create([{ name: 'Coupon race A', price: 10, stock: 2 }, { name: 'Coupon race B', price: 10, stock: 2 }]);
  const coupon = await Coupon.create({ code: 'LASTCOUPON', discountPercent: 10, minOrderAmount: 0, maxDiscountAmount: 5, maxRedemptions: 1 });
  const results = await Promise.all(products.map((p) => checkout({ items: [{ productId: String(p._id), quantity: 1 }], guestInfo: { name: 'Test', email: 'test@example.invalid' }, couponCode: coupon.code })));
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [201, 409]);
  assert.equal((await Coupon.findById(coupon._id)).redemptionCount, 1);
});
test('catalog index migration replaces collection scan with bounded indexed recent lookup', { skip: !enabled }, async () => {
  const db = mongoose.connection.db;
  const collection = db.collection('products');
  await collection.insertMany(Array.from({ length: 1500 }, (_, i) => ({ name: `Synthetic ${i}`, stock: 1, price: 10, archivedAt: i % 10 === 0 ? new Date() : null, createdAt: new Date(i * 1000), flashSale: i % 3 === 0, flashSaleEndsAt: new Date(Date.now() + i * 1000 + 60000) })));
  const query = () => collection.find({ archivedAt: null }).sort({ createdAt: -1 }).limit(8);
  const before = await query().explain('executionStats');
  const saleQuery = () => collection.find({ archivedAt: null, flashSale: true, flashSaleEndsAt: { $gt: new Date() } }).sort({ flashSaleEndsAt: 1 }).limit(1);
  const saleBefore = await saleQuery().explain('executionStats');
  const { ensureCatalogIndexes } = require('../scripts/ensureCatalogIndexes');
  assert.ok((await ensureCatalogIndexes(db)).some((entry) => entry.status === 'would-create'));
  await ensureCatalogIndexes(db, { apply: true });
  const after = await query().explain('executionStats');
  const saleAfter = await saleQuery().explain('executionStats');
  assert.equal(saleAfter.executionStats.nReturned, 1);
  assert.ok(saleAfter.executionStats.totalDocsExamined <= 1);
  console.log('EXPLAIN_SALE', JSON.stringify({ beforeDocs: saleBefore.executionStats.totalDocsExamined, afterDocs: saleAfter.executionStats.totalDocsExamined }));
  assert.equal(after.executionStats.nReturned, 8);
  assert.ok(after.executionStats.totalKeysExamined > 0);
  assert.ok(after.executionStats.totalDocsExamined <= 8);
  assert.ok((await ensureCatalogIndexes(db)).every((entry) => entry.status === 'existing'));
  console.log('EXPLAIN_RECENT', JSON.stringify({ beforeDocs: before.executionStats.totalDocsExamined, afterDocs: after.executionStats.totalDocsExamined, returned: after.executionStats.nReturned }));
});

test('catalog price pagination uses effective expired-sale prices', { skip: !enabled }, async () => {
  const Product = require('../models/Product');
  const category = 'effective-sort-test';
  await Product.create([{ name: 'Expired sort', category, price: 5, originalPrice: 100, flashSale: true, flashSaleEndsAt: new Date(0), stock: 2 }, { name: 'Regular sort', category, price: 10, stock: 2 }]);
  const res = { status() { return this; }, json(value) { this.body = value; } };
  await require('../controllers/productController').getProducts({ query: { category, sort: 'price_asc', limit: '1' } }, res, (error) => { throw error; });
  assert.equal(res.body.products[0].name, 'Regular sort');
});

test('legacy admin enrollment and reset races remain safe in real Mongo', { skip: !enabled }, async () => {
  process.env.SESSION_SECRET = 'integration-mfa-test-secret-long-enough';
  const User = require('../models/User'); const mfa = require('../services/adminMfa');
  const controller = require('../controllers/authController');
  const id = new mongoose.Types.ObjectId();
  await User.collection.insertOne({ _id: id, name: 'Legacy', email: 'legacy-mfa@example.invalid', role: 'admin', password: 'unused-test-hash' });
  const secret = mfa.generateSecret();
  const makeRequest = (body, mode = 'verify') => ({ body, adminMfaPreauth: { userId: String(id), authVersion: 0, pendingSecret: secret, mode }, session: { regenerate(callback) { delete this.user; callback(); }, save(callback) { callback(); } } });
  const makeResponse = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const req = makeRequest({ code: mfa.generateTotp(secret, Math.floor(Date.now() / 30000)) }, 'enroll'); const res = makeResponse();
  await controller.confirmAdminMfaEnrollment(req, res); assert.equal(res.body.success, true);
  // Reset the replay marker to exercise the TOTP branch rather than an already consumed step.
  await User.updateOne({ _id: id }, { $set: { adminMfaLastTotpStep: -1 } });
  const original = User.findOneAndUpdate;
  for (const body of [{ code: mfa.generateTotp(secret, Math.floor(Date.now() / 30000)) }, { recoveryCode: res.body.recoveryCodes[0] }]) {
    await User.collection.updateOne({ _id: id }, { $unset: { authVersion: '' } });
    User.findOneAndUpdate = function(filter, update, options) {
      return { select: async (fields) => {
        await User.collection.updateOne({ _id: id }, { $set: { authVersion: 1 } });
        return original.call(this, filter, update, options).select(fields);
      } };
    };
    const attempt = makeRequest(body); const result = makeResponse();
    try { await controller.verifyAdminMfa(attempt, result); }
    finally { User.findOneAndUpdate = original; }
    assert.equal(result.statusCode, 401); assert.equal(attempt.session.user, undefined);
  }
});

test('lease loss after writes aborts the entire Mongo transaction', { skip: !enabled }, async () => {
  const Lock = require('../models/MaintenanceLock'); const Product = require('../models/Product');
  const p = await Product.create({ name: 'Lease rollback', price: 10, stock: 5 });
  const lease = await require('../services/productReservationLock').acquireProductReservationLocks([p._id]);
  const assertOwned = lease.assertOwned; let checks = 0;
  lease.assertOwned = async (options) => { if (++checks === 2) throw new Error('injected lease loss'); return assertOwned(options); };
  try {
    await assert.rejects(require('../services/inventoryTransaction').withInventoryTransaction(async (session) => {
      await Product.updateOne({ _id: p._id }, { $inc: { stock: -1 } }, { session });
    }, { lease }), /lease loss/);
    assert.equal((await Product.findById(p._id)).stock, 5);
  } finally { await lease.release(); }
});

test('uncertain commit response retries commit without duplicating stock or coupon', { skip: !enabled }, async () => {
  const Product = require('../models/Product'); const Coupon = require('../models/Coupon'); const Order = require('../models/Order');
  const p = await Product.create({ name: 'Uncertain commit', stock: 3, price: 10 });
  const coupon = await Coupon.create({ code: 'UNCERTAIN', discountPercent: 10, minOrderAmount: 0, maxDiscountAmount: 5 });
  const connection = mongoose.connection; const originalStart = connection.startSession; let commits = 0;
  connection.startSession = async function(...args) {
    const session = await originalStart.apply(this, args); const originalCommit = session.commitTransaction.bind(session);
    session.commitTransaction = async function(...commitArgs) {
      const result = await originalCommit(...commitArgs);
      if (++commits === 1) { const error = new mongoose.mongo.MongoServerError({ message: 'injected lost commit response' }); error.addErrorLabel('UnknownTransactionCommitResult'); throw error; }
      return result;
    };
    return session;
  };
  const body = { items: [{ productId: String(p._id), quantity: 1 }], guestInfo: { name: 'Test', email: 'test@example.invalid' }, couponCode: coupon.code, checkoutKey: 'aabbccdd-1234-4567-890a-aabbccddeeff' };
  let result;
  try { result = await checkout(body); } finally { connection.startSession = originalStart; }
  assert.equal(result.statusCode, 201); assert.ok(commits >= 2);
  assert.equal((await Product.findById(p._id)).stock, 2);
  assert.equal((await Coupon.findById(coupon._id)).redemptionCount, 1);
  const replay = await checkout(body); assert.equal(String(replay.body.orderId), String(result.body.orderId));
  assert.equal(await Order.countDocuments({ 'items.product': p._id }), 1);
});

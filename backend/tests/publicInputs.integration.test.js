const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const enabled = process.env.TECHSTORE_INTEGRATION === '1';
let replica;

test.before(async () => {
  if (!enabled) return;
  replica = await startLocalReplicaSet();
  await mongoose.connect(replica.uri);
  await require('../models/Newsletter').init();
});
test.after(async () => {
  if (!enabled) return;
  await mongoose.disconnect();
  await replica?.stop();
});

test('concurrent newsletter subscriptions return the same response with a real unique index', { skip: !enabled }, async () => {
  const Newsletter = require('../models/Newsletter');
  const { subscribeNewsletter } = require('../controllers/newsletterController');
  const email = `${randomUUID()}@example.invalid`;
  const subscribe = async () => {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await subscribeNewsletter({ body: { email, consent: true } }, res, (error) => { throw error; });
    return { code: res.code, body: res.body };
  };
  const results = await Promise.all(Array.from({ length: 6 }, subscribe));
  for (const result of results) assert.deepEqual(result, results[0]);
  assert.equal(results[0].code, 201);
  assert.equal(await Newsletter.countDocuments({ email }), 1);
  await Newsletter.updateOne({ email }, { $set: { isSubscribed: false }, $unset: { unsubscribeToken: 1 } });
  assert.deepEqual(await subscribe(), results[0]);
  assert.equal((await Newsletter.findOne({ email }).lean()).isSubscribed, true);
});

test('direct checkout service rejects invalid guest names before touching MongoDB inventory', { skip: !enabled }, async () => {
  const { createCheckout } = require('../services/checkoutService');
  await assert.rejects(() => createCheckout({
    items: [{ productId: new mongoose.Types.ObjectId(), quantity: 1 }],
    guestInfo: { name: 'Guest\nTotal: 0', email: 'guest@example.invalid' },
  }), { statusCode: 400 });
  assert.equal(await mongoose.connection.collection('orders').countDocuments({}), 0);
  assert.equal(await mongoose.connection.collection('maintenance_locks').countDocuments({}), 0);
});

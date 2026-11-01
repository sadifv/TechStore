const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const enabled = process.env.TECHSTORE_INTEGRATION === '1';
test('expired and archived alerts redact addresses and release confirmed slots without sending', {skip:!enabled},async()=>{
  const Alert=require('../models/RestockAlert'),Quota=require('../models/RestockQuota');const {emailKey}=require('../services/restockTokens');const p=await product({stock:1,archivedAt:new Date()});const key=emailKey('cleanup@example.invalid');
  await Quota.create({_id:key,active:['cleanup-archived','cleanup-expired']});
  await Alert.create([{_id:'cleanup-archived',requestKey:'cleanup-archived',product:p._id,email:'cleanup@example.invalid',emailKey:key,status:'waiting',generation:'cleanup',expiresAt:new Date(Date.now()+86400000)},
    {_id:'cleanup-expired',requestKey:'cleanup-expired',product:p._id,email:'cleanup@example.invalid',emailKey:key,status:'waiting',generation:'cleanup',expiresAt:new Date(0)}]);
  let sent=0;await require('../services/restockQueue').processRestockAlerts(async()=>{sent++;});assert.equal(sent,0);
  assert.equal((await Quota.findById(key)).active.length,0);
  for(const id of ['cleanup-archived','cleanup-expired']){const row=await Alert.findById(id).select('+email +emailKey').lean();assert.equal(row.status,'expired');assert.equal(row.email,undefined);assert.equal(row.emailKey,undefined);}
});
test('HTTP preferences only change on explicit POST and reject cross-site requests', {skip:!enabled},async()=>{
  const {issueToken,emailKey}=require('../services/restockTokens');const c=issueToken(),u=issueToken(),p=await product();
  const Alert=require('../models/RestockAlert');await Alert.create({_id:'http-pref',requestKey:'http-pref',product:p._id,email:'http@example.invalid',emailKey:emailKey('http@example.invalid'),status:'pending_confirmation',generation:'http',confirmHash:c.hash,unsubscribeHashes:[u.hash],confirmExpiresAt:new Date(Date.now()+86400000),expiresAt:new Date(Date.now()+86400000)});
  const get=await fetch(url+'/restock-alerts/confirm');assert.equal(get.status,404);assert.equal((await Alert.findById('http-pref')).status,'pending_confirmation');
  const post=(action,token,origin)=>fetch(url+'/restock-alerts/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify({token})});
  assert.equal((await post('confirm',c.token,'https://evil.example.invalid')).status,403);
  assert.equal((await post('confirm',c.token,'https://store.example.invalid')).status,200);
  assert.equal((await Alert.findById('http-pref')).status,'waiting');
  assert.equal((await post('unsubscribe',u.token)).status,200);assert.equal((await Alert.findById('http-pref')).status,'cancelled');
});
test('restock query indexes can be prepared explicitly on the isolated destination and reused', {skip:!enabled},async()=>{
  const {ensureRestockIndexes}=require('../scripts/ensureRestockIndexes');const db=mongoose.connection.db;
  await ensureRestockIndexes(db,{apply:true,databaseName:db.databaseName});
  const report=await ensureRestockIndexes(db);assert.ok(report.every(r=>r.status==='existing'));
});
test(
  'confirmation quotas are atomic, pending requests do not consume slots and cancellation frees one',
  { skip: !enabled },
  async () => {
    const crypto = require('node:crypto');
    const { issueToken, emailKey } = require('../services/restockTokens');
    const s = require('../services/restockAlerts');
    const Alert = require('../models/RestockAlert'),
      Quota = require('../models/RestockQuota');
    const p = await product();
    const email = 'quota@example.invalid',
      key = emailKey(email);
    await Quota.create({ _id: key, active: Array.from({ length: 19 }, (_, i) => `existing-${i}`) });
    const rows = [];
    for (let i = 0; i < 2; i++) {
      const c = issueToken(),
        u = issueToken();
      const row = await Alert.create({
        _id: `quota-${i}`,
        requestKey: `quota-${i}`,
        email,
        emailKey: key,
        product: p._id,
        status: 'pending_confirmation',
        generation: crypto.randomUUID(),
        confirmHash: c.hash,
        unsubscribeHashes: [u.hash],
        confirmExpiresAt: new Date(Date.now() + 86400000),
        expiresAt: new Date(Date.now() + 86400000),
      });
      rows.push({ row, c, u });
    }
    const results = await Promise.allSettled(rows.map((r) => s.confirmAlert(r.c.token)));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await Quota.findById(key)).active.length, 20);
    const winner = results.findIndex((r) => r.status === 'fulfilled'),
      loser = 1 - winner;
    await s.unsubscribeAlert(rows[winner].u.token);
    await s.confirmAlert(rows[loser].c.token);
    assert.equal((await Quota.findById(key)).active.length, 20);
    const late = issueToken();
    await Alert.create({
      _id: 'late-confirm',
      requestKey: 'late-confirm',
      email: 'late@example.invalid',
      emailKey: emailKey('late@example.invalid'),
      product: p._id,
      status: 'pending_confirmation',
      generation: crypto.randomUUID(),
      confirmHash: late.hash,
      confirmExpiresAt: new Date(Date.now() + 86400000),
      expiresAt: new Date(Date.now() + 86400000),
    });
    await s.confirmAlert(late.token);
    assert.equal((await Alert.findById('late-confirm')).status, 'waiting');
    await Alert.updateOne(
      { _id: 'late-confirm' },
      { $set: { status: 'pending_confirmation', confirmExpiresAt: new Date(0) } },
    );
    await assert.rejects(s.confirmAlert(late.token), /válido/);
  },
);
test(
  'interrupted deliveries are not resent and old stockouts do not starve available products',
  { skip: !enabled },
  async () => {
    const Alert = require('../models/RestockAlert');
    const q = require('../services/restockQueue');
    const { issueToken } = require('../services/restockTokens');
    await Alert.deleteMany({});
    const stockout = await product(),
      ready = await product({ stock: 1 });
    for (let i = 0; i < 51; i++)
      await Alert.create({
        _id: `scan-${String(i).padStart(3, '0')}`,
        requestKey: `scan-${i}`,
        product: i === 50 ? ready._id : stockout._id,
        email: 'scan@example.invalid',
        status: 'waiting',
        generation: 'test',
        expiresAt: new Date(Date.now() + 86400000),
      });
    let sends = 0;
    await q.processRestockAlerts(async () => {
      sends++;
      return { success: true, messageId: 'fake' };
    });
    assert.equal(sends, 0);
    await q.processRestockAlerts(async () => {
      sends++;
      return { success: true, messageId: 'fake' };
    });
    assert.equal(sends, 1);
    const token = issueToken();
    await Alert.create({
      _id: 'interrupted',
      requestKey: 'interrupted',
      product: ready._id,
      email: 'interrupted@example.invalid',
      status: 'sending',
      claim: 'old',
      generation: 'old',
      leaseUntil: new Date(0),
      expiresAt: new Date(Date.now() + 86400000),
      unsubscribeHashes: [token.hash],
    });
    await q.processRestockAlerts(async () => {
      sends++;
    });
    assert.equal(sends, 1);
    assert.equal((await Alert.findById('interrupted')).status, 'delivery_unknown');
    await Alert.deleteMany({});
  },
);
test(
  'restock requests canonicalize product IDs and a cancellation during preparation prevents sending',
  { skip: !enabled },
  async () => {
    const s = require('../services/restockAlerts');
    const q = require('../services/restockQueue');
    const p = await product();
    const mails = [];
    const args = { productId: p.id, email: 'cancel-test@example.invalid', consent: true };
    await s.requestAlert(args, async (m) => mails.push(m));
    await s.requestAlert({ ...args, productId: p.id.toUpperCase() }, async (m) => mails.push(m));
    assert.equal(mails.length, 1);
    await s.confirmAlert(new URL(mails[0].confirmUrl).hash.slice(1));
    await require('../models/Product').updateOne({ _id: p._id }, { $set: { stock: 1 } });
    const Reservation = require('../models/Reservation');
    const original = Reservation.getReservedStock;
    Reservation.getReservedStock = async () => {
      await s.unsubscribeAlert(new URL(mails[0].unsubscribeUrl).hash.slice(1));
      return 0;
    };
    let sent = 0;
    try {
      await q.processRestockAlerts(async () => {
        sent++;
        return { success: true, messageId: 'fake' };
      });
    } finally {
      Reservation.getReservedStock = original;
    }
    assert.equal(sent, 0);
  },
);
let replica, server, url, user, other;
test.before(async () => {
  if (!enabled) return;
  replica = await startLocalReplicaSet();
  await mongoose.connect(replica.uri);
  const User = require('../models/User');
  [user, other] = await User.create([
    { name: 'Test', email: 'favorite@example.invalid', password: 'password-test-123' },
    { name: 'Other', email: 'other@example.invalid', password: 'password-test-456' },
  ]);
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/csrfProtection').createCsrfProtection(['https://store.example.invalid']));
  app.use((req, res, next) => {
    req.session = {};
    if (req.headers['x-user']) req.session.user = { id: req.headers['x-user'], authVersion: 0 };
    next();
  });
  app.use('/favorites', require('../routes/favoriteRoutes'));
  app.use('/restock-alerts', require('../routes/restockAlertRoutes'));
  app.use((error, req, res, next) =>
    res.status(error.statusCode || 500).json({ success: false, error: error.message }),
  );
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  url = `http://127.0.0.1:${server.address().port}`;
  for (const name of ['FavoriteList', 'RestockAlert', 'RestockQuota'])
    await require(`../models/${name}`).init();
});
test.after(async () => {
  if (!enabled) return;
  if (server) await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  await replica?.stop();
});
async function request(path, method = 'GET', identity = user) {
  const r = await fetch(url + path, {
    method,
    headers: { Accept: 'application/json', ...(identity ? { 'x-user': identity.id } : {}) },
  });
  return { status: r.status, data: await r.json() };
}
const product = (extra = {}) =>
  require('../models/Product').create({ name: 'Producto', price: 10, stock: 0, ...extra });

test(
  'favorites enforce private ownership, idempotency, archived removals and atomic limit',
  { skip: !enabled },
  async () => {
    const p = await product({ stock: 2 });
    assert.equal((await request('/favorites', 'GET', null)).status, 401);
    assert.equal((await request(`/favorites/${p.id}`, 'PUT')).status, 200);
    assert.equal((await request(`/favorites/${p.id}`, 'PUT')).status, 200);
    assert.equal((await request('/favorites')).data.ids.length, 1);
    assert.equal((await request('/favorites', 'GET', other)).data.ids.length, 0);
    await require('../models/Product').updateOne(
      { _id: p._id },
      { $set: { archivedAt: new Date() } },
    );
    assert.equal((await request('/favorites')).data.items[0].unavailable, true);
    assert.equal((await request(`/favorites/${p.id}`, 'DELETE')).status, 200);
    const ids = Array.from({ length: 99 }, () => new mongoose.Types.ObjectId());
    await require('../models/FavoriteList').updateOne(
      { user: user._id },
      { $set: { products: ids } },
    );
    const [a, b] = await Promise.all([product(), product()]);
    const adds = await Promise.all([
      request(`/favorites/${a.id}`, 'PUT'),
      request(`/favorites/${b.id}`, 'PUT'),
    ]);
    assert.deepEqual(adds.map((r) => r.status).sort(), [200, 409]);
    assert.equal((await request('/favorites')).data.ids.length, 100);
  },
);

test(
  'restock consent, confirmation expiry, deduplication and unsubscribe preserve privacy',
  { skip: !enabled },
  async () => {
    const service = require('../services/restockAlerts');
    const p = await product();
    const mails = [];
    const send = async (m) => {
      mails.push(m);
      return { success: true, messageId: 'fake' };
    };
    await assert.rejects(
      service.requestAlert(
        { productId: p.id, email: 'person@example.invalid', consent: false },
        send,
      ),
      /consentimiento/,
    );
    await service.requestAlert(
      { productId: p.id, email: 'person@example.invalid', consent: true },
      send,
    );
    assert.equal(mails.length, 1);
    const token = new URL(mails[0].confirmUrl).hash.slice(1);
    const Alert = require('../models/RestockAlert');
    let alert = await Alert.findOne({ product: p._id }).select('+confirmHash').lean();
    assert.notEqual(alert.confirmHash, token);
    assert.equal(JSON.stringify(alert).includes(token), false);
    await service.confirmAlert(token);
    await service.confirmAlert(token);
    await service.requestAlert(
      { productId: p.id, email: 'person@example.invalid', consent: true },
      send,
    );
    assert.equal(mails.length, 1);
    assert.equal((await Alert.findById(alert._id)).status, 'waiting');
    await assert.rejects(service.confirmAlert('0'.repeat(64)), /válido/);
    const queue = require('../services/restockQueue');
    const notices = [];
    await Promise.all([
      queue.processRestockAlerts(async (m) => {
        notices.push(m);
        return { success: true, messageId: 'fake' };
      }),
      queue.processRestockAlerts(send),
    ]);
    assert.equal(notices.length, 0);
    await require('../models/Product').updateOne({ _id: p._id }, { $set: { stock: 2 } });
    await Promise.all([
      queue.processRestockAlerts(async (m) => {
        notices.push(m);
        return { success: true, messageId: 'fake' };
      }),
      queue.processRestockAlerts(async (m) => {
        notices.push(m);
        return { success: true, messageId: 'fake' };
      }),
    ]);
    assert.equal(notices.length, 1);
    await queue.processRestockAlerts(send);
    assert.equal(notices.length, 1);
    const unsubscribeToken = new URL(notices[0].unsubscribeUrl).hash.slice(1);
    await service.unsubscribeAlert(unsubscribeToken);
    alert = await Alert.findById(alert._id).lean();
    assert.equal(alert.email, undefined);
  },
);

test(
  'restock workers respect reservations, cancellation and unknown delivery outcomes',
  { skip: !enabled },
  async () => {
    const s = require('../services/restockAlerts');
    const q = require('../services/restockQueue');
    const Alert = require('../models/RestockAlert');
    const p = await product();
    let confirmation;
    await s.requestAlert(
      { productId: p.id, email: 'queue@example.invalid', consent: true },
      async (m) => {
        confirmation = m;
        return { success: true, messageId: 'fake' };
      },
    );
    await s.confirmAlert(new URL(confirmation.confirmUrl).hash.slice(1));
    await require('../models/Product').updateOne({ _id: p._id }, { $set: { stock: 1 } });
    await require('../models/Reservation').create({
      product: p._id,
      user: user._id,
      sessionId: 'isolated',
      quantity: 1,
      expiresAt: new Date(Date.now() + 60000),
    });
    let sent = 0;
    await q.processRestockAlerts(async () => {
      sent++;
      return { success: true, messageId: 'fake' };
    });
    assert.equal(sent, 0);
    await require('../models/Reservation').deleteMany({ product: p._id });
    await q.processRestockAlerts(async () => {
      sent++;
      throw new Error('Network outcome unknown');
    });
    assert.equal(sent, 1);
    await q.processRestockAlerts(async () => {
      sent++;
    });
    assert.equal(sent, 1);
    const row = await Alert.findOne({ product: p._id });
    assert.equal(row.status, 'delivery_unknown');
    assert.equal(row.email, undefined);
  },
);

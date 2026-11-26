const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');

test('saved builds are private, migrate the legacy slot and report live catalog changes', {
  skip: process.env.TECHSTORE_INTEGRATION !== '1',
}, async (t) => {
  const replica = await startLocalReplicaSet();
  t.after(async () => {
    await mongoose.disconnect();
    await replica.stop();
  });
  await mongoose.connect(replica.uri);
  const selection = (part) =>
    new URLSearchParams([['kit', 'study'], ...[part].flat().map((name) => ['part', name])]).toString();
  const [first, second] = await User.create([
    { name: 'Primero', email: 'first@example.invalid', password: 'test-password-only', savedBuild: selection('Teclado') },
    { name: 'Segundo', email: 'second@example.invalid', password: 'test-password-only' },
  ]);
  const [keyboard] = await Product.create([
    { name: 'Teclado', price: 20, stock: 1 },
    { name: 'Ratón', price: 30, stock: 1 },
  ]);

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const account = req.get('x-test-account') === '1' ? first : req.get('x-test-account') === '2' ? second : null;
    if (account) req.user = { id: String(account._id), authVersion: 0 };
    next();
  });
  app.use('/api/saved-build', require('../routes/savedBuildRoutes'));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const call = (account, method, part, path = '') => fetch(
    `http://127.0.0.1:${server.address().port}/api/saved-build${path}`,
    {
      method,
      headers: { 'x-test-account': account, 'content-type': 'application/json' },
      ...(part ? { body: JSON.stringify({ selection: selection(part) }) } : {}),
    },
  );
  assert.equal((await call('', 'GET')).status, 401);
  const legacy = await call('1', 'GET');
  assert.equal(legacy.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await legacy.json()).builds, [
    { id: 'anterior', selection: selection('Teclado'), changes: null },
  ]);
  const repeated = await Promise.all([call('1', 'PUT', 'Teclado'), call('1', 'PUT', 'Teclado')]);
  assert.ok(repeated.every(({ status }) => status === 200));
  assert.equal((await call('1', 'PUT', 'Ratón')).status, 200);
  assert.equal((await call('1', 'PUT', 'Pieza inexistente')).status, 409);
  await Product.updateOne({ _id: keyboard._id }, { $set: { price: 25 } });
  await Reservation.create({
    product: keyboard._id, user: second._id, quantity: 1,
    status: 'active', expiresAt: new Date(Date.now() + 60_000),
  });
  const list = (await (await call('1', 'GET')).json()).builds;
  assert.equal(list.length, 2);
  const savedKeyboard = list.find((build) => build.selection === selection('Teclado'));
  assert.deepEqual(savedKeyboard.changes, [
    { name: 'Teclado', previousPrice: 20, currentPrice: 25, available: false },
  ]);
  assert.deepEqual((await (await call('2', 'GET')).json()).builds, []);
  assert.equal((await call('2', 'DELETE', null, `/${savedKeyboard.id}`)).status, 200);
  assert.equal((await (await call('1', 'GET')).json()).builds.length, 2);
  assert.equal((await call('1', 'DELETE', null, `/${savedKeyboard.id}`)).status, 200);
  assert.equal((await (await call('1', 'GET')).json()).builds.length, 1);
  assert.equal((await call('1', 'PUT', ['Teclado', 'Ratón'])).status, 200);
  assert.equal((await (await call('1', 'PUT', ['Ratón', 'Teclado'])).json()).alreadySaved, true);
  assert.equal((await (await call('1', 'GET')).json()).builds.length, 2);
});

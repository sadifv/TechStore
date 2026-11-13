const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');

test(
  'guía exige sesión vigente y consulta catálogo aislado sin escribir pedidos',
  { skip: process.env.TECHSTORE_INTEGRATION !== '1' },
  async (t) => {
    const replica = await startLocalReplicaSet();
    t.after(async () => {
      await mongoose.disconnect();
      await replica.stop();
    });
    await mongoose.connect(replica.uri);
    const Product = require('../models/Product');
    const Reservation = require('../models/Reservation');
    const User = require('../models/User');
    const user = await User.create({
      name: 'Prueba',
      email: 'guided@example.invalid',
      password: 'fixture-password-only',
    });
    const base = {
      name: 'Auricular de prueba',
      category: 'Audio',
      price: 90,
      stock: 1,
      specifications: [{ name: 'Micrófono', value: 'Integrado' }],
    };
    const reserved = await Product.create(base);
    await Product.create({ ...base, name: 'Disponible', price: 80 });
    await Product.create({ ...base, name: 'Archivado', archivedAt: new Date() });
    await Reservation.create({
      product: reserved._id,
      user: user._id,
      quantity: 1,
      expiresAt: new Date(Date.now() + 60000),
    });
    const app = express();
    app.use(express.json());
    // Sesión sintética exclusivamente de esta prueba; no usa cookies ni cuentas reales.
    app.use((req, res, next) => {
      if (req.headers['x-test-session'])
        req.session = {
          user: { id: String(user._id), authVersion: 0 },
          destroy: (callback) => callback(),
        };
      next();
    });
    app.post(
      '/api/ai/recommendations',
      require('../middleware/authMiddleware').requireAuth,
      require('../controllers/guidedShoppingController').getGuidedRecommendations,
    );
    const server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/api/ai/recommendations`;
    const post = (body, session = true) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { 'x-test-session': 'fixture' } : {}),
        },
        body: JSON.stringify(body),
      });
    const preferences = { category: 'Audio', use: 'videollamadas', budget: 90 };
    assert.equal((await post(preferences, false)).status, 401);
    assert.equal((await post({ ...preferences, budget: { $gt: 0 } })).status, 400);
    const response = await post(preferences);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json();
    assert.deepEqual(
      result.products.map((product) => product.name),
      ['Disponible'],
    );
    assert.equal(await Reservation.countDocuments(), 1);
    await User.updateOne({ _id: user._id }, { $inc: { authVersion: 1 } });
    assert.equal((await post(preferences)).status, 401);
  },
);

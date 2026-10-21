const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const express = require('express');
const { reset, addProduct, state } = require('./helpers/orderControllerHarness');

const originalLoad = Module._load;
let adminRoutes;
let orderRoutes;
try {
  Module._load = function (request, parent, isMain) {
    if (parent?.filename.endsWith('authMiddleware.js') && request === '../models/User') {
      return {
        findById: (id) => ({
          select: () => ({
            lean: async () => ({
              _id: id,
              name: 'Administración',
              role: id === 'admin' ? 'admin' : 'user',
            }),
          }),
        }),
      };
    }
    if (parent?.filename.endsWith('orderRoutes.js') && request === '../middleware/rateLimiter') {
      return { checkoutLimiter: (_req, _res, next) => next() };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  adminRoutes = require('../routes/orderAdminRoutes');
  orderRoutes = require('../routes/orderRoutes');
} finally {
  Module._load = originalLoad;
}

test('flujo HTTP de checkout, contacto y pago exige administrador y permite reintentos seguros', async (t) => {
  reset();
  const productId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  addProduct(productId, 3);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.headers['x-test-user'])
      req.session = {
        authLevel: req.headers['x-test-user'] === 'admin' ? 'mfa' : 'password',
        user: { id: req.headers['x-test-user'] },
      };
    next();
  });
  app.use('/api/orders', orderRoutes);
  app.use('/api/admin/orders', adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (url, body, user) =>
    fetch(`${base}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(user ? { 'x-test-user': user } : {}),
      },
      body: JSON.stringify(body),
    });
  const created = await post('/api/orders/checkout', {
    checkoutKey: '11111111-1111-4111-8111-111111111111',
    items: [{ productId, quantity: 1 }],
    guestInfo: { name: 'Cliente', email: 'cliente@example.test' },
  });
  assert.equal(created.status, 201);
  const { orderId } = await created.json();
  const action = `/api/admin/orders/${orderId}`;
  assert.equal((await post(`${action}/confirm-payment`, {})).status, 403);
  assert.equal((await post(`${action}/confirm-payment`, {}, 'customer')).status, 403);
  assert.equal(state.orders[0].paymentStatus, 'pending');
  assert.equal((await post(`${action}/confirm-contact`, {}, 'admin')).status, 200);
  assert.equal((await post(`${action}/confirm-payment`, {}, 'admin')).status, 200);
  assert.equal((await post(`${action}/confirm-payment`, {}, 'admin')).status, 200);
  assert.equal((await post(`${action}/cancel`, {}, 'admin')).status, 409);
  assert.equal(state.orders[0].paymentConfirmedBy, 'admin');
  assert.deepEqual(
    state.orders[0].events.map((event) => event.type),
    ['created', 'contact_confirmed', 'payment_confirmed'],
  );
  assert.equal(state.products.get(productId).stock, 2);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const express = require('express');
const User = require('../models/User');
const invoked = [];
const handler = (name) => (req, res) => { invoked.push(name); res.json({ success: true, handler: name }); };
const originalLoad = Module._load;
const mocks = {
  '../controllers/productController': Object.fromEntries(['createProduct', 'updateProduct', 'deleteProduct', 'activateFlashSale', 'deactivateFlashSale'].map((key) => [key, handler(key)])),
  '../controllers/orderController': { updateOrderStatus: handler('updateOrderStatus') },
  '../controllers/marketingController': Object.fromEntries(['createAdminCoupon', 'updateAdminCouponStatus', 'sendAdminCampaign'].map((key) => [key, handler(key)])),
  '../middleware/uploadMiddleware': { uploadSingleProductImage: (req, res, next) => next() },
  '../models/Contact': { findByIdAndDelete: async () => invoked.push('deleteMessage') },
  '../models/Newsletter': { findByIdAndDelete: async () => invoked.push('deleteSubscriber') },
};
let apiRoutes, adminRoutes;
try {
  Module._load = function (name, parent, ...args) {
    if (parent?.filename.endsWith('adminMutationRoutes.js') && mocks[name]) return mocks[name];
    return originalLoad.call(this, name, parent, ...args);
  };
  apiRoutes = require('../routes/apiRoutes');
  adminRoutes = require('../routes/adminRoutes');
} finally { Module._load = originalLoad; }

test('all administrative writes resolve through the API proxy and retain authorization and product validation', async (t) => {
  const originalFind = User.findById;
  User.findById = (role) => ({ select: () => ({ lean: async () => ({ _id: role, role, name: 'Test', authVersion: 0 }) }) });
  t.after(() => { User.findById = originalFind; });
  const app = express(); app.use(express.json());
  app.use((req, res, next) => {
    const role = req.headers['x-test-role'];
    if (role) req.session = { user: { id: role, authVersion: 0 }, authLevel: req.headers['x-test-mfa'] === 'no' ? 'password' : 'mfa' };
    next();
  });
  app.use('/api', apiRoutes); app.use('/admin', adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const product = { name: 'Test product', price: 10, stock: 2, category: 'Gaming' };
  const routes = [
    ['POST', '/products', product, 'createProduct'],
    ['PUT', '/products/123', product, 'updateProduct'],
    ['DELETE', '/products/123', {}, 'deleteProduct'],
    ['POST', '/products/123/flash-sale', {}, 'activateFlashSale'],
    ['DELETE', '/products/123/flash-sale', {}, 'deactivateFlashSale'],
    ['POST', '/coupons', {}, 'createAdminCoupon'],
    ['PATCH', '/coupons/123/status', {}, 'updateAdminCouponStatus'],
    ['POST', '/campaigns', {}, 'sendAdminCampaign'],
    ['PUT', '/orders/123/status', {}, 'updateOrderStatus'],
    ['DELETE', '/messages/123', {}, 'deleteMessage'],
    ['DELETE', '/subscribers/123', {}, 'deleteSubscriber'],
  ];
  const call = (prefix, method, path, body, role, mfa = 'yes') => fetch(`${base}${prefix}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(role ? { 'x-test-role': role, 'x-test-mfa': mfa } : {}) }, body: JSON.stringify(body),
  });
  for (const [method, path, body, expected] of routes) {
    for (const role of [null, 'user']) {
      const before = invoked.length;
      assert.equal((await call('/api/admin', method, path, body, role)).status, 403, `${method} ${path} ${role}`);
      assert.equal(invoked.length, before);
    }
    for (const prefix of ['/api/admin', '/admin']) {
      for (const role of ['admin', 'owner']) {
        const res = await call(prefix, method, path, body, role);
        assert.equal(res.status, 200, `${prefix} ${method} ${path} ${role}`);
        assert.equal(invoked.at(-1), expected);
      }
    }
  }
  assert.equal((await call('/api/admin', 'POST', '/coupons', {}, 'admin', 'no')).status, 403);
  for (const [method, path] of [['POST', '/products'], ['PUT', '/products/123']]) {
    const before = invoked.length;
    assert.equal((await call('/api/admin', method, path, {}, 'owner')).status, 400);
    assert.equal(invoked.length, before);
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const User = require('../models/User');
const Product = require('../models/Product');
const Contact = require('../models/Contact');
const Audit = require('../models/AdminAuditEvent');
const { requireAdmin } = require('../middleware/authMiddleware');
const controller = require('../controllers/adminCatalogController');

test(
  'staff catalog pagination and audited restore preserve inventory and enforce MFA',
  { skip: process.env.TECHSTORE_INTEGRATION !== '1' },
  async (t) => {
    const replica = await startLocalReplicaSet();
    t.after(async () => {
      await mongoose.disconnect();
      await replica.stop();
    });
    await mongoose.connect(replica.uri);
    await Promise.all([User.init(), Product.init(), Contact.init(), Audit.createCollection()]);
    const staff = await User.create({
      name: 'Staff fixture',
      email: 'staff@example.invalid',
      password: 'Fixture-password-123',
      role: 'admin',
    });
    const buyer = await User.create({
      name: 'Buyer fixture',
      email: 'buyer@example.invalid',
      password: 'Fixture-password-123',
      role: 'user',
    });
    const archived = await Product.create({
      name: 'Archived fixture',
      category: 'Muebles',
      price: 99,
      stock: 7,
      archivedAt: new Date(),
    });
    const old = new Date('2020-01-01');
    await Product.insertMany(
      Array.from({ length: 23 }, (_, i) => ({
        name: `Fixture ${i}`,
        price: 10 + i,
        stock: 5,
        category: 'Audio',
        createdAt: old,
      })),
    );
    await Product.create({ name: 'Literal .* fixture', price: 1, category: 'Audio', stock: 1 });
    await Contact.insertMany(
      Array.from({ length: 23 }, (_, i) => ({
        name: `Contact ${i}`,
        email: 'contact@example.invalid',
        message: 'Fixture',
        createdAt: old,
      })),
    );
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.session = req.headers['x-user']
        ? { user: { id: req.headers['x-user'] }, authLevel: req.headers['x-level'] || 'mfa' }
        : {};
      next();
    });
    app.get('/api/admin/products', requireAdmin, controller.getProducts);
    app.get('/api/admin/messages', requireAdmin, controller.getMessages);
    app.patch('/api/admin/products/:id/restore', requireAdmin, controller.restoreProduct);
    app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ success: false }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = { 'x-user': String(staff._id) };
    const get = (path, extra = {}) => fetch(base + path, { headers: { ...headers, ...extra } });
    assert.equal((await fetch(base + '/api/admin/products')).status, 403);
    assert.equal((await get('/api/admin/products', { 'x-user': String(buyer._id) })).status, 403);
    assert.equal((await get('/api/admin/products', { 'x-level': 'password' })).status, 403);
    const first = (await (await get('/api/admin/products')).json()).data;
    const second = (await (await get('/api/admin/products?page=2')).json()).data;
    assert.equal(first.products.length, 20);
    assert.equal(second.products.length, 4);
    assert.equal(new Set([...first.products, ...second.products].map((p) => p._id)).size, 24);
    assert.equal((await (await get('/api/admin/products?q=.*')).json()).data.products.length, 1);
    assert.equal((await (await get('/api/admin/messages?page=2')).json()).data.messages.length, 3);
    assert.equal((await get('/api/admin/products?page=-1')).status, 400);
    const restore = () =>
      fetch(base + `/api/admin/products/${archived._id}/restore`, { method: 'PATCH', headers });
    const originalAuditCreate = Audit.create;
    Audit.create = async () => {
      throw new Error('Fixture audit failure');
    };
    try {
      assert.equal((await restore()).status, 500);
    } finally {
      Audit.create = originalAuditCreate;
    }
    assert.ok((await Product.findById(archived._id)).archivedAt);
    assert.equal((await restore()).status, 200);
    const saved = await Product.findById(archived._id);
    assert.equal(saved.archivedAt, null);
    assert.equal(saved.price, 99);
    assert.equal(saved.stock, 7);
    assert.equal((await restore()).status, 404);
    assert.equal(
      await Audit.countDocuments({ action: 'product.restored', resourceId: String(archived._id) }),
      1,
    );
  },
);

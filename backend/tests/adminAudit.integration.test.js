const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const Audit = require('../models/AdminAuditEvent');
const Product = require('../models/Product');
const User = require('../models/User');
const { auditedHandler, getAudit } = require('../services/adminAudit');
const { requireOwner } = require('../middleware/authMiddleware');
const controller = require('../controllers/productController');
const enabled = process.env.TECHSTORE_INTEGRATION === '1';
function response() {
  return {
    statusCode: 200,
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    set() {
      return this;
    },
  };
}
async function invoke(handler, req) {
  const res = response();
  await handler(req, res, (error) => {
    throw error;
  });
  return res;
}
test(
  'administrative audit persists atomically, excludes private fields and enforces HTTP permissions',
  { skip: !enabled },
  async (t) => {
    const replica = await startLocalReplicaSet();
    t.after(async () => {
      await mongoose.disconnect();
      await replica.stop();
    });
    await mongoose.connect(replica.uri);
    await Promise.all([Product.init(), User.init(), Audit.createCollection()]);
    const owner = await User.create({
      name: 'Audit owner',
      email: 'audit-owner@example.invalid',
      password: 'Test-password-123',
      role: 'owner',
    });
    const admin = await User.create({
      name: 'Audit admin',
      email: 'audit-admin@example.invalid',
      password: 'Test-password-123',
      role: 'admin',
    });
    const customer = await User.create({
      name: 'Audit customer',
      email: 'audit-customer@example.invalid',
      password: 'Test-password-123',
      role: 'user',
    });
    const req = (body) => ({ body, params: {}, user: { id: String(admin._id) } });
    const base = {
      name: 'Fixture',
      description: 'private descriptive text',
      price: 20,
      category: 'audio',
      stock: 5,
    };
    let product;
    await t.test(
      'product create/update specifications preserve omitted values and clear explicit []',
      async () => {
        const created = await invoke(
          controller.createProduct,
          req({ ...base, specifications: JSON.stringify([{ name: 'RAM', value: '16GB' }]) }),
        );
        product = created.body.data;
        assert.equal(created.statusCode, 201);
        assert.equal(product.specifications[0].value, '16GB');
        const update = { ...req({ price: 21 }), params: { id: String(product._id) } };
        await invoke(controller.updateProduct, update);
        assert.equal((await Product.findById(product._id)).specifications[0].value, '16GB');
        await invoke(controller.updateProduct, { ...update, body: { specifications: [] } });
        assert.deepEqual((await Product.findById(product._id)).specifications, []);
        const event = await Audit.findOne({ action: 'product.created' }).lean();
        assert.equal(String(event.actorId), String(admin._id));
        assert.equal(event.resourceId, String(product._id));
        assert.equal(JSON.stringify(event).includes('private descriptive'), false);
        assert.equal(JSON.stringify(event).includes('16GB'), false);
        assert.deepEqual(event.changes.map((c) => c.field).slice(0, 2), ['price', 'stock']);
        const count = await Audit.countDocuments();
        await assert.rejects(
          invoke(controller.updateProduct, {
            ...update,
            body: { price: 999, specifications: '{bad' },
          }),
          (e) => e.statusCode === 400,
        );
        assert.equal((await Product.findById(product._id)).price, 21);
        assert.equal(await Audit.countDocuments(), count);
      },
    );
    await t.test(
      'audit insert failure rolls back the product and produces no successful response',
      async () => {
        const original = Audit.create;
        Audit.create = async () => {
          throw new Error('injected audit failure');
        };
        try {
          await assert.rejects(
            invoke(controller.updateProduct, {
              ...req({ price: 99 }),
              params: { id: String(product._id) },
            }),
            /injected audit/,
          );
        } finally {
          Audit.create = original;
        }
        assert.equal((await Product.findById(product._id)).price, 21);
      },
    );
    await t.test(
      'error responses, next(error), and missing audit resources roll back earlier writes',
      async () => {
        const cases = [
          async (req, res) => {
            await Product.updateOne({ _id: product._id }, { $set: { price: 77 } });
            res.status(409).json({ success: false });
          },
          async (req, res, next) => {
            await Product.updateOne({ _id: product._id }, { $set: { price: 77 } });
            next(new Error('callback failure'));
          },
          async (req, res) => {
            await Product.updateOne({ _id: product._id }, { $set: { price: 77 } });
            res.json({ success: true });
          },
        ];
        const rejected = await invoke(auditedHandler(cases[0], 'product.updated'), req({}));
        assert.equal(rejected.statusCode, 409);
        for (const handler of cases.slice(1))
          await assert.rejects(invoke(auditedHandler(handler, 'product.updated'), req({})));
        assert.equal((await Product.findById(product._id)).price, 21);
      },
    );
    await t.test(
      'explicit indexes are dry run by default and require matching target to apply',
      async () => {
        const { ensureAuditIndexes } = require('../scripts/ensureAuditIndexes');
        const dry = await ensureAuditIndexes(mongoose.connection.db);
        assert.ok(dry.every((x) => x.status === 'would-create'));
        await assert.rejects(
          ensureAuditIndexes(mongoose.connection.db, { apply: true, databaseName: 'wrong' }),
        );
        await ensureAuditIndexes(mongoose.connection.db, {
          apply: true,
          databaseName: mongoose.connection.db.databaseName,
        });
        assert.ok(
          (await ensureAuditIndexes(mongoose.connection.db)).every((x) => x.status === 'existing'),
        );
      },
    );
    await t.test(
      'history HTTP rejects anonymous/user/admin/password owner and has no write/delete route',
      async () => {
        const app = express();
        app.use((req, res, next) => {
          if (req.headers['x-test-id'])
            req.session = {
              user: { id: req.headers['x-test-id'] },
              authLevel: req.headers['x-test-auth'] || 'mfa',
            };
          next();
        });
        app.get('/api/admin/audit', requireOwner, getAudit);
        const server = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        try {
          const url = `http://127.0.0.1:${server.address().port}/api/admin/audit`;
          for (const id of [null, String(customer._id), String(admin._id)])
            assert.equal(
              (
                await fetch(url, {
                  headers: { Accept: 'application/json', ...(id ? { 'x-test-id': id } : {}) },
                })
              ).status,
              403,
            );
          assert.equal(
            (
              await fetch(url, {
                headers: {
                  Accept: 'application/json',
                  'x-test-id': String(owner._id),
                  'x-test-auth': 'password',
                },
              })
            ).status,
            403,
          );
          const headers = { Accept: 'application/json', 'x-test-id': String(owner._id) };
          const result = await fetch(url + '?action=product.updated&limit=1', { headers });
          assert.equal(result.status, 200);
          assert.equal(result.headers.get('cache-control'), 'no-store');
          const body = await result.json();
          assert.equal(body.data.events.length, 1);
          assert.ok(body.data.startedAt);
          assert.ok(body.data.events.every((e) => e.action === 'product.updated'));
          assert.equal((await fetch(url, { method: 'DELETE', headers })).status, 404);
          assert.equal((await fetch(url, { method: 'POST', headers })).status, 404);
        } finally {
          await new Promise((resolve) => server.close(resolve));
        }
      },
    );
  },
);

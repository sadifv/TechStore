const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const User = require('../models/User');
const StoreContent = require('../models/StoreContent');
const Audit = require('../models/AdminAuditEvent');
const { requireAdmin } = require('../middleware/authMiddleware');
const { defaults } = require('../services/storeContent');
const controller = require('../controllers/storeContentController');

test(
  'content editor enforces MFA, versions and atomic audit without changing defaults',
  { skip: process.env.TECHSTORE_INTEGRATION !== '1' },
  async (t) => {
    const replica = await startLocalReplicaSet();
    t.after(async () => {
      await mongoose.disconnect();
      await replica.stop();
    });
    await mongoose.connect(replica.uri);
    await User.init();
    await StoreContent.createCollection();
    await Audit.createCollection();
    const staff = await User.create({
      name: 'Content staff',
      email: 'content@example.invalid',
      password: 'Fixture-password-123',
      role: 'admin',
    });
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.session = req.headers['x-test-level']
        ? { user: { id: String(staff._id) }, authLevel: req.headers['x-test-level'] }
        : {};
      next();
    });
    app.get('/public', controller.getContent);
    app.patch('/content', requireAdmin, controller.updateContent);
    app.use((err, req, res, next) => {
      void next;
      res.status(err.statusCode || 500).json({ success: false });
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    const patch = (revision, content, level = 'mfa') =>
      fetch(base + '/content', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...(level ? { 'x-test-level': level } : {}),
        },
        body: JSON.stringify({ revision, content }),
      });
    assert.deepEqual((await (await fetch(base + '/public')).json()).content, defaults);
    assert.equal((await patch(0, { hours: 'Horario de prueba' }, null)).status, 403);
    assert.equal((await patch(0, { hours: 'Horario de prueba' }, 'password')).status, 403);
    assert.equal((await patch(0, { heroImage: 'javascript:alert(1)' })).status, 400);
    assert.equal((await patch(0, { hours: 'Horario de prueba' })).status, 200);
    assert.equal(await Audit.countDocuments({ action: 'content.updated' }), 1);
    assert.equal((await patch(0, { hours: 'No debe guardarse' })).status, 409);
    const originalCreate = Audit.create;
    Audit.create = async () => {
      throw new Error('Fixture audit failure');
    };
    try {
      assert.equal((await patch(1, { hours: 'Rollback' })).status, 500);
    } finally {
      Audit.create = originalCreate;
    }
    const stored = await StoreContent.findById('global').lean();
    assert.equal(stored.revision, 1);
    assert.equal(stored.content.hours, 'Horario de prueba');
    await User.updateOne({ _id: staff._id }, { $set: { role: 'user' } });
    assert.equal((await patch(1, { hours: 'No autorizado' })).status, 403);
    assert.equal(
      (await (await fetch(base + '/public')).json()).content.heroLead,
      defaults.heroLead,
    );
  },
);

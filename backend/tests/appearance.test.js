const mongoose = require('mongoose');
const Audit = require('../models/AdminAuditEvent');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const User = require('../models/User');
const Appearance = require('../models/StoreAppearance');
const { requireOwner } = require('../middleware/authMiddleware');
const controller = require('../controllers/appearanceController');

test('appearance is public to read, strictly validated and writable only by current owner with MFA', async () => {
  const originals = [User.findById, Appearance.findById, Appearance.findOneAndUpdate];
  const originalTransaction = mongoose.connection.transaction,
    originalCreate = Audit.create;
  mongoose.connection.transaction = async (fn) => fn({});
  Audit.create = async () => [];
  let saved;
  User.findById = () => ({
    select: () => ({
      lean: async () => ({ _id: 'test-owner', role: currentRole, authVersion: 0 }),
    }),
  });
  Appearance.findById = () => ({ lean: async () => (saved ? { theme: saved } : null) });
  Appearance.findOneAndUpdate = async (query, change) => {
    saved = change.$set.theme;
    return { theme: saved };
  };
  let currentRole = 'owner';
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = req.headers['x-test-auth']
      ? { user: { id: 'test-owner' }, authLevel: req.headers['x-test-auth'] }
      : {};
    next();
  });
  app.get('/api/store/appearance', controller.getAppearance);
  app.patch('/api/admin/appearance', requireOwner, controller.updateAppearance);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const patch = (body, auth) =>
    fetch(base + '/api/admin/appearance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(auth ? { 'x-test-auth': auth } : {}) },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await (await fetch(base + '/api/store/appearance')).json()).theme, 'normal');
    assert.equal((await patch({ theme: 'christmas' })).status, 403);
    currentRole = 'admin';
    assert.equal((await patch({ theme: 'christmas' }, 'mfa')).status, 403);
    currentRole = 'owner';
    assert.equal((await patch({ theme: 'christmas' }, 'password')).status, 403);
    for (const body of [
      { theme: 'https://evil.invalid/css' },
      { theme: ['normal'] },
      { theme: 'normal', role: 'owner' },
    ])
      assert.equal((await patch(body, 'mfa')).status, 400);
    assert.equal(saved, undefined);
    assert.equal((await patch({ theme: 'christmas' }, 'mfa')).status, 200);
    assert.equal((await (await fetch(base + '/api/store/appearance')).json()).theme, 'christmas');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    [User.findById, Appearance.findById, Appearance.findOneAndUpdate] = originals;
    mongoose.connection.transaction = originalTransaction;
    Audit.create = originalCreate;
  }
});

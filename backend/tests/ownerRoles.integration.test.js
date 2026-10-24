const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const User = require('../models/User');
const { promoteOwner } = require('../scripts/promoteOwner');
const enabled = process.env.TECHSTORE_INTEGRATION === '1';

test('owner migration, MFA and user management enforce the privilege boundary in MongoDB and HTTP', { skip: !enabled }, async (t) => {
  process.env.SESSION_SECRET = 'owner-integration-test-secret-only-not-production';
  const replica = await startLocalReplicaSet();
  t.after(async () => { await mongoose.disconnect(); await replica.stop(); });
  await mongoose.connect(replica.uri);
  await User.init();
  const password = 'Owner-test-password-123';
  const create = (name, role) => User.create({ name, email: `${name}@example.invalid`, password, role });
  let owner;
  await t.test('migration is explicit, refuses ambiguous administrators and is idempotent', async () => {
    await assert.rejects(promoteOwner(), /exactamente un/);
    owner = await create('owner', 'admin');
    const other = await create('extra', 'admin');
    await assert.rejects(promoteOwner({ apply: true }), /exactamente un/);
    await User.deleteOne({ _id: other._id });
    assert.equal((await promoteOwner()).status, 'dry-run');
    assert.equal((await User.findById(owner._id)).role, 'admin');
    assert.equal((await promoteOwner({ apply: true })).status, 'promoted');
    assert.equal((await promoteOwner({ apply: true })).status, 'already-configured');
    owner = await User.findById(owner._id).select('+authVersion');
    assert.equal(owner.role, 'owner');
    assert.equal(owner.authVersion, 1);
    await assert.rejects(create('second-owner', 'owner'), (error) => error.code === 11000);
  });

  const auth = require('../controllers/authController');
  const mfa = require('../services/adminMfa');
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const session = () => ({ regenerate(cb) { delete this.user; delete this.adminMfaPreauth; cb(); }, save(cb) { cb(); } });
  await t.test('owner password requires MFA; enrollment, TOTP and recovery preserve owner role', async () => {
    const req = { body: { email: owner.email, password }, session: session() };
    let res = response();
    await auth.loginUser(req, res);
    assert.equal(res.body.mfaEnrollmentRequired, true);
    assert.equal(req.session.user, undefined);
    req.adminMfaPreauth = req.session.adminMfaPreauth;
    res = response();
    await auth.beginAdminMfaEnrollment(req, res);
    const secret = res.body.secret;
    assert.ok(secret);
    req.body = { code: mfa.generateTotp(secret, Math.floor(Date.now() / 30000)) };
    res = response();
    await auth.confirmAdminMfaEnrollment(req, res);
    assert.equal(res.body.user.role, 'owner');
    assert.equal(req.session.authLevel, 'mfa');
    const recoveryCode = res.body.recoveryCodes[0];
    // Permit the current time step for a fresh verification, using only isolated test data.
    await User.updateOne({ _id: owner._id }, { $set: { adminMfaLastTotpStep: -1 } });
    const verify = { session: session(), adminMfaPreauth: { userId: String(owner._id), authVersion: 1, mode: 'verify' }, body: req.body };
    res = response(); await auth.verifyAdminMfa(verify, res);
    assert.equal(res.body.user.role, 'owner');
    verify.body = { recoveryCode }; res = response(); await auth.verifyAdminMfa(verify, res);
    assert.equal(res.body.user.role, 'owner');
  });

  const admin = await create('admin', 'admin');
  const customer = await create('customer', 'user');
  const app = express(); app.use(express.json());
  app.use((req, res, next) => {
    if (req.headers['x-test-id']) req.session = {
      user: { id: req.headers['x-test-id'], authVersion: Number(req.headers['x-test-version'] || 0) },
      authLevel: req.headers['x-test-mfa'] === 'no' ? 'password' : 'mfa',
      destroy(cb) { cb(); },
    };
    next();
  });
  app.use('/api', require('../routes/apiRoutes'));
  app.use('/admin', require('../routes/adminRoutes'));
  app.use((error, req, res, next) => { res.status(500).json({ error: error.message }); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (url, method, body, actor, version = 0, mfaLevel = 'yes') => fetch(`${base}${url}`, {
    method, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(actor ? { 'x-test-id': String(actor._id), 'x-test-version': String(version), 'x-test-mfa': mfaLevel } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const roleUrl = (user) => `/api/admin/users/${user._id}/role`;
  await t.test('public registration ignores privileged role fields', async () => {
    for (const role of ['owner', 'admin']) {
      const req = { body: { name: `forged-${role}`, email: `forged-${role}@example.invalid`, password, role } };
      const res = response();
      await auth.registerUser(req, res, (error) => { throw error; });
      assert.equal(res.statusCode, 202);
      assert.equal((await User.findOne({ email: req.body.email })).role, 'user');
    }
  });
  await t.test('anonymous, customers and admins cannot change roles; owner needs MFA and current session version', async () => {
    for (const actor of [null, customer, admin]) assert.equal((await call(roleUrl(customer), 'PATCH', { role: 'admin' }, actor)).status, 403);
    assert.equal((await call(roleUrl(customer), 'PATCH', { role: 'admin' }, owner, 1, 'no')).status, 403);
    assert.equal((await call(roleUrl(customer), 'PATCH', { role: 'admin' }, owner, 0)).status, 403);
    assert.equal((await call('/api/admin/users', 'GET', null, owner, 1)).status, 200);
    const ownerList = await (await call('/api/admin/users?role=owner', 'GET', null, owner, 1)).json();
    assert.equal(ownerList.data.canManageRoles, true);
    assert.equal(ownerList.data.users.length, 1);
    assert.equal(ownerList.data.users[0].role, 'owner');
    const adminList = await (await call('/api/admin/users', 'GET', null, admin)).json();
    assert.equal(adminList.data.canManageRoles, false);
  });
  await t.test('owner cannot be assigned via API, demoted or deleted by any administrator', async () => {
    assert.equal((await call(roleUrl(customer), 'PATCH', { role: 'owner' }, owner, 1)).status, 400);
    assert.equal((await call(roleUrl(owner), 'PATCH', { role: 'user' }, owner, 1)).status, 409);
    for (const prefix of ['/admin', '/api/admin']) {
      for (const actor of [admin, owner]) assert.equal((await call(`${prefix}/users/${owner._id}`, 'DELETE', null, actor, actor === owner ? 1 : 0)).status, 409);
      assert.equal((await call(`${prefix}/users/${admin._id}`, 'DELETE', null, admin)).status, 409);
    }
    for (const actor of [null, customer]) assert.equal((await call(`/api/admin/users/${customer._id}`, 'DELETE', null, actor)).status, 403);
  });
  await t.test('owner promotes and demotes, revoking existing sessions and MFA preauthentication', async () => {
    assert.equal((await call(roleUrl(customer), 'PATCH', { role: 'admin' }, owner, 1)).status, 200);
    assert.equal((await call('/api/admin/users', 'GET', null, customer, 0)).status, 403);
    assert.equal((await call('/api/admin/users', 'GET', null, customer, 1, 'no')).status, 403);
    const loginReq = { body: { email: customer.email, password }, session: session() };
    const loginRes = response(); await auth.loginUser(loginReq, loginRes);
    assert.equal(loginRes.body.mfaEnrollmentRequired, true);
    assert.equal(loginReq.session.user, undefined);
    assert.equal((await call(roleUrl(customer), 'PATCH', { role: 'user' }, owner, 1)).status, 200);
    assert.equal((await call('/api/admin/users', 'GET', null, customer, 1)).status, 403);
    assert.equal((await User.findById(customer._id).select('+authVersion')).authVersion, 2);
    const { requireAdminMfaPreauth } = require('../middleware/authMiddleware');
    const req = { session: { adminMfaPreauth: { userId: String(customer._id), authVersion: 1, mode: 'enroll', expiresAt: Date.now() + 60000 } } };
    const res = response(); await requireAdminMfaPreauth(req, res, () => assert.fail('stale preauth accepted'));
    assert.equal(res.statusCode, 401);
    assert.equal((await call(`/api/admin/users/${customer._id}`, 'DELETE', null, admin)).status, 200);
  });
});

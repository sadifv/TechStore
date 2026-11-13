const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Module = require('node:module');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const User = require('../models/User');

test(
  'account changes authenticate, consume email tokens once and revoke sessions atomically',
  { skip: process.env.TECHSTORE_INTEGRATION !== '1' },
  async (t) => {
    const replica = await startLocalReplicaSet();
    t.after(async () => {
      await mongoose.disconnect();
      await replica.stop();
    });
    await mongoose.connect(replica.uri);
    await User.init();
    let delivered;
    let deliveryFails = false;
    const originalLoad = Module._load;
    Module._load = function (name, parent, isMain) {
      if (name === '../config/mailer' && parent.filename.endsWith('accountSecurityController.js'))
        return {
          sendAccountEmailChange: async (email, token) => {
            if (deliveryFails) throw new Error('Delivery fixture failure');
            delivered = { email, token };
            return { success: true };
          },
        };
      return originalLoad.call(this, name, parent, isMain);
    };
    let controller;
    try {
      controller = require('../controllers/accountSecurityController');
    } finally {
      Module._load = originalLoad;
    }
    const user = await User.create({
      name: 'Account Test',
      email: 'original@example.invalid',
      password: 'original-test-password',
      isVerified: true,
    });
    const call = async (action, body, overrides = {}) => {
      const current = await User.findById(user._id).select('+authVersion');
      const req = {
        body,
        user: { id: String(user._id), authVersion: current.authVersion },
        session: { user: {}, destroy: (done) => done() },
        ...overrides,
      };
      const res = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.body = body;
          return this;
        },
        clearCookie() {},
      };
      await controller[action](req, res, (error) => {
        throw error;
      });
      return res;
    };
    assert.equal((await call('changeName', { name: 'New Name', role: 'owner' })).statusCode, 400);
    assert.equal((await call('changeName', { name: 'New Name' })).statusCode, 200);
    assert.equal((await User.findById(user._id)).name, 'New Name');
    assert.equal(
      (
        await call('changePassword', {
          currentPassword: 'wrong-password',
          password: 'replacement-test-password',
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call('changePassword', {
          currentPassword: 'original-test-password',
          password: 'é'.repeat(37),
        })
      ).statusCode,
      400,
    );
    const changed = await call('changePassword', {
      currentPassword: 'original-test-password',
      password: 'replacement-test-password',
    });
    assert.equal(changed.statusCode, 200);
    let current = await User.findById(user._id).select('+password +authVersion');
    assert.equal(current.authVersion, 1);
    assert.equal(await bcrypt.compare('replacement-test-password', current.password), true);
    const credentials = { currentPassword: 'replacement-test-password' };
    assert.equal(
      (await call('requestEmailChange', { ...credentials, email: ['bad@example.invalid'] }))
        .statusCode,
      400,
    );
    assert.equal(
      (await call('requestEmailChange', { ...credentials, email: 'next@example.invalid' }))
        .statusCode,
      200,
    );
    current = await User.findById(user._id).select('+emailChangeHash');
    assert.equal(current.email, 'original@example.invalid');
    assert.notEqual(current.emailChangeHash, delivered.token);
    assert.equal(delivered.email, 'next@example.invalid');
    assert.equal(
      (await call('confirmEmailChange', { ...credentials, token: 'a'.repeat(64) })).statusCode,
      400,
    );
    const confirmation = { ...credentials, token: delivered.token };
    const results = await Promise.all([
      call('confirmEmailChange', confirmation),
      call('confirmEmailChange', confirmation),
    ]);
    // Si la segunda lectura ocurre tras consumir el token, falla en validación
    // (400); si ambas lo leen antes, pierde la actualización atómica (409).
    // En ambos casos debe existir exactamente una confirmación exitosa.
    const statuses = results.map((res) => res.statusCode).sort();
    assert.equal(statuses[0], 200);
    assert.ok([400, 409].includes(statuses[1]));
    current = await User.findById(user._id).select('+authVersion +emailChangeHash');
    assert.equal(current.email, 'next@example.invalid');
    assert.equal(current.authVersion, 2);
    assert.equal(current.emailChangeHash, undefined);
    assert.equal((await call('confirmEmailChange', confirmation)).statusCode, 400);
    assert.equal(
      (await call('requestEmailChange', { ...credentials, email: 'expired@example.invalid' }))
        .statusCode,
      200,
    );
    const expiredToken = delivered.token;
    assert.equal(
      (await call('requestEmailChange', { ...credentials, email: 'too-soon@example.invalid' }))
        .statusCode,
      429,
    );
    await User.updateOne(
      { _id: user._id },
      { $set: { emailChangeExpires: new Date(Date.now() - 1000) } },
    );
    assert.equal(
      (await call('confirmEmailChange', { ...credentials, token: expiredToken })).statusCode,
      400,
    );
    await User.create({
      name: 'Other Account',
      email: 'taken@example.invalid',
      password: 'other-fixture-password',
    });
    assert.equal(
      (await call('requestEmailChange', { ...credentials, email: 'taken@example.invalid' }))
        .statusCode,
      200,
    );
    assert.equal(
      (await call('confirmEmailChange', { ...credentials, token: delivered.token })).statusCode,
      409,
    );
    assert.equal((await User.findById(user._id)).email, 'next@example.invalid');
    await User.updateOne({ _id: user._id }, { $unset: { emailChangeExpires: '' } });
    assert.equal(
      (await call('requestEmailChange', { ...credentials, email: 'revoked@example.invalid' }))
        .statusCode,
      200,
    );
    await User.updateOne({ _id: user._id }, { $inc: { authVersion: 1 } });
    assert.equal(
      (await call('confirmEmailChange', { ...credentials, token: delivered.token })).statusCode,
      400,
    );
    await User.updateOne({ _id: user._id }, { $unset: { emailChangeExpires: '' } });
    deliveryFails = true;
    assert.equal(
      (await call('requestEmailChange', { ...credentials, email: 'unreachable@example.invalid' }))
        .statusCode,
      503,
    );
    assert.equal(
      (await User.findById(user._id).select('+emailChangeHash')).emailChangeHash,
      undefined,
    );
    await User.updateOne({ _id: user._id }, { $set: { role: 'admin' } });
    assert.equal((await call('changeName', { name: 'Not Allowed' })).statusCode, 403);
    assert.equal(
      (await call('changePassword', { ...credentials, password: 'other-password-for-test' }))
        .statusCode,
      403,
    );
    process.env.SESSION_SECRET = 'isolated-account-security-mfa-fixture-only';
    const mfa = require('../services/adminMfa');
    const secret = mfa.generateSecret();
    const step = Math.floor(Date.now() / 30000);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          adminMfaSecret: mfa.encryptSecret(secret),
          adminMfaEnabledAt: new Date(),
          adminMfaLastTotpStep: step - 1,
        },
      },
    );
    const session = () => ({ user: {}, authLevel: 'mfa', destroy: (done) => done() });
    const staffBody = {
      ...credentials,
      password: 'staff-replacement-test-password',
      code: mfa.generateTotp(secret, step),
    };
    const staffResults = await Promise.all([
      call('changePassword', staffBody, { session: session() }),
      call('changePassword', staffBody, { session: session() }),
    ]);
    assert.equal(staffResults.filter((result) => result.statusCode === 200).length, 1);
    assert.ok(staffResults.some((result) => [403, 409].includes(result.statusCode)));
    assert.equal((await User.findById(user._id)).role, 'admin');
    assert.equal(
      (
        await call(
          'changePassword',
          {
            currentPassword: 'staff-replacement-test-password',
            password: 'replay-fixture-password',
            code: staffBody.code,
          },
          { session: session() },
        )
      ).statusCode,
      409,
    );
  },
);

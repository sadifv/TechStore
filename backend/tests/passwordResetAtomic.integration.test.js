const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const User = require('../models/User');
const enabled = process.env.TECHSTORE_INTEGRATION === '1';

test(
  'a reset token can change a password only once under concurrent requests',
  { skip: !enabled },
  async (t) => {
    const replica = await startLocalReplicaSet();
    t.after(async () => {
      await mongoose.disconnect();
      await replica.stop();
    });
    await mongoose.connect(replica.uri);
    const token = crypto.randomBytes(32).toString('hex');
    const user = await User.create({
      name: 'Reset Test',
      email: 'reset-atomic@example.invalid',
      password: 'original-password-test',
      authVersion: 4,
      resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex'),
      resetPasswordExpires: new Date(Date.now() + 60000),
    });
    const { resetPassword } = require('../controllers/authController');
    const call = async (password) => {
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
      };
      await resetPassword({ params: { token }, body: { password } }, res, (e) => {
        throw e;
      });
      return { ...res, password };
    };
    const results = await Promise.all([call('first-password-test'), call('second-password-test')]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 400]);
    const current = await User.findById(user._id).select(
      '+password +authVersion +resetPasswordToken +resetPasswordExpires',
    );
    assert.equal(current.authVersion, 5);
    assert.equal(current.resetPasswordToken, undefined);
    assert.equal(current.resetPasswordExpires, undefined);
    assert.equal(
      await bcrypt.compare(results.find((r) => r.statusCode === 200).password, current.password),
      true,
    );
    assert.equal((await call('third-password-test')).statusCode, 400);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await User.updateOne(
      { _id: user._id },
      {
        $set: { resetPasswordToken: tokenHash, resetPasswordExpires: new Date(Date.now() - 1000) },
      },
    );
    assert.equal((await call('expired-password-test')).statusCode, 400);
    await User.updateOne(
      { _id: user._id },
      { $set: { resetPasswordExpires: new Date(Date.now() + 60000) } },
    );
    for (const invalid of ['short', 'é'.repeat(37), { $ne: null }, undefined])
      assert.equal((await call(invalid)).statusCode, 400);
    const unchanged = await User.findById(user._id).select('+authVersion +resetPasswordToken');
    assert.equal(unchanged.authVersion, 5);
    assert.equal(unchanged.resetPasswordToken, tokenHash);
    assert.equal((await call('valid-password-after-rejection')).statusCode, 200);
    assert.equal((await User.findById(user._id).select('+authVersion')).authVersion, 6);
  },
);

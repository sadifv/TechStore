const assert = require('node:assert/strict');
const { test } = require('node:test');
const User = require('../models/User');

test('authentication secrets are excluded from user queries by default', () => {
  for (const field of [
    'password',
    'verificationToken',
    'verificationTokenExpires',
    'resetPasswordToken',
    'resetPasswordExpires',
    'emailChangeTarget',
    'emailChangeHash',
    'emailChangeExpires',
    'emailChangeVersion',
  ]) {
    assert.equal(User.schema.path(field).options.select, false, `${field} must default to hidden`);
  }
});

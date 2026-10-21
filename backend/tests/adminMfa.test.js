const assert = require('node:assert/strict');
const test = require('node:test');
const mfa = require('../services/adminMfa');

test('TOTP validates current code and rejects invalid or expired codes', () => {
  assert.equal(mfa.generateTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1), '287082');
  const secret = Buffer.alloc(20, 7).toString('base64');
  const now = 1_800_000_000_000;
  const step = Math.floor(now / 30_000);
  const code = mfa.generateTotp(secret, step);
  assert.equal(mfa.verifyTotp(secret, code, now).step, step);
  assert.equal(mfa.verifyTotp(secret, '000000', now), null);
  assert.equal(mfa.verifyTotp(secret, code, now + 120_000), null);
});

test('TOTP encryption authenticates ciphertext and rejects a wrong key', () => {
  process.env.SESSION_SECRET = 'test-session-secret-long-enough-for-hkdf';
  const encrypted = mfa.encryptSecret('JBSWY3DPEHPK3PXP');
  assert.equal(mfa.decryptSecret(encrypted), 'JBSWY3DPEHPK3PXP');
  process.env.SESSION_SECRET = 'different-test-session-secret-long-enough';
  assert.throws(() => mfa.decryptSecret(encrypted));
});

test('recovery codes are random, formatted, and only hashes are persisted', () => {
  const codes = mfa.generateRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  assert.ok(codes.every((code) => /^[A-F0-9]{4}(?:-[A-F0-9]{4}){5}$/.test(code)));
  assert.ok(codes.every((code) => code.replace(/-/g, '').length === 24));
  assert.notEqual(mfa.hashRecoveryCode(codes[0]), codes[0]);
});

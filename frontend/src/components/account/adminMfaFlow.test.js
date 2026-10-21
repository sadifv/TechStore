import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAdminMfaStep } from './adminMfaFlow.js';

test('maps first admin login to enrollment and later login to verification', () => {
  assert.equal(getAdminMfaStep({ mfaEnrollmentRequired: true }), 'enroll');
  assert.equal(getAdminMfaStep({ mfaRequired: true }), 'verify');
  assert.equal(getAdminMfaStep({ success: true, user: { role: 'user' } }), null);
});

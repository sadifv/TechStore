const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const { isOrderSuccessAccessible } = require('../services/orderSuccessAccess');

const checkoutKey = '11111111-1111-4111-8111-111111111111';
const guestOrder = {
  checkoutKey: crypto.createHash('sha256').update(`guest:${checkoutKey}`).digest('hex'),
};

test('guest order details require the checkout key', () => {
  assert.equal(isOrderSuccessAccessible({ order: guestOrder }), false);
  assert.equal(isOrderSuccessAccessible({ order: guestOrder, checkoutKey: 'invalid' }), false);
  assert.equal(isOrderSuccessAccessible({ order: guestOrder, checkoutKey }), true);
});

test('account order details require the matching owner session', () => {
  const accountOrder = { user: 'user-123', checkoutKey: 'unused' };
  assert.equal(isOrderSuccessAccessible({ order: accountOrder, userId: 'user-123' }), true);
  assert.equal(isOrderSuccessAccessible({ order: accountOrder, userId: 'user-456' }), false);
  assert.equal(
    isOrderSuccessAccessible({ order: accountOrder, userId: 'user-123', checkoutKey: 'wrong' }),
    true,
  );
});

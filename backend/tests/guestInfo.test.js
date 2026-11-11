const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeGuestInfo, whatsappBuyerName } = require('../services/guestInfo');

test('guest identity limits apply to the checkout service entry point too', () => {
  for (const name of [
    '',
    '  ',
    'x'.repeat(121),
    'Cliente\r\nTotal: 0',
    'Nombre\u0000',
    'Nombre\u200b',
  ]) {
    assert.throws(() => normalizeGuestInfo({ name, email: 'guest@example.invalid' }), {
      statusCode: 400,
    });
  }
  assert.equal(
    normalizeGuestInfo({ name: 'x'.repeat(120), email: 'guest@example.invalid' }).name.length,
    120,
  );
  assert.deepEqual(
    normalizeGuestInfo({ name: "  José O'Neill  ", email: ' Guest@Example.invalid ' }),
    {
      name: "José O'Neill",
      email: 'guest@example.invalid',
    },
  );
});

test('legacy WhatsApp names cannot introduce extra lines or oversized messages', () => {
  assert.equal(whatsappBuyerName('Cliente\r\nTotal: 0\u202e'), 'Cliente  Total: 0');
  assert.equal(whatsappBuyerName('x'.repeat(500)).length, 120);
  assert.equal(whatsappBuyerName(undefined), 'Cliente');
});

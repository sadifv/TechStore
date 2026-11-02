const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReview } = require('../services/productReviews');
const { validateAddress } = require('../services/customerAddresses');
test('reviews require integer stars and plain bounded text', () => {
  assert.deepEqual(validateReview({ rating: 5, text: 'Buen producto para mi trabajo.' }), {
    rating: 5,
    text: 'Buen producto para mi trabajo.',
  });
  for (const data of [
    { rating: 0, text: 'Suficiente texto válido' },
    { rating: 1.5, text: 'Suficiente texto válido' },
    { rating: 5, text: '<b>Texto inválido</b>' },
    { rating: 5, text: 'corto' },
    { rating: '5', text: 'Suficiente texto válido' },
  ])
    assert.throws(() => validateReview(data));
});
test('addresses allow only minimal bounded text fields', () => {
  const a = {
    recipient: 'Cliente Test',
    street: 'Calle 123',
    city: 'Guayaquil',
    country: 'Ecuador',
  };
  assert.equal(validateAddress({ ...a, userId: 'other', role: 'owner' }).userId, undefined);
  for (const changes of [
    { street: '<script>invalid</script>' },
    { recipient: {} },
    { city: 'x'.repeat(101) },
    { street: 'Calle\nOtro' },
  ])
    assert.throws(() => validateAddress({ ...a, ...changes }));
});

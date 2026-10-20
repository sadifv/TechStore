const assert = require('node:assert/strict');
const test = require('node:test');
const Reservation = require('../models/Reservation');

test('gets active reservation totals for all products using one grouped aggregation', async () => {
  const productIds = ['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb'];
  let pipeline;
  Reservation.aggregate = async (value) => {
    pipeline = value;
    return [
      { _id: productIds[0], totalReserved: 2 },
      { _id: productIds[1], totalReserved: 4 },
    ];
  };

  const totals = await Reservation.getReservedStockByProducts(productIds);

  assert.deepEqual([...totals], [[productIds[0], 2], [productIds[1], 4]]);
  assert.deepEqual(pipeline[0].$match.product.$in, productIds);
  assert.equal(pipeline[0].$match.status, 'active');
  assert.ok(pipeline[0].$match.expiresAt.$gt instanceof Date);
  assert.deepEqual(pipeline[1].$group, { _id: '$product', totalReserved: { $sum: '$quantity' } });
});

test('returns an empty map without querying when the product list is empty', async () => {
  let calls = 0;
  Reservation.aggregate = async () => { calls += 1; return []; };
  assert.deepEqual(await Reservation.getReservedStockByProducts([]), new Map());
  assert.equal(calls, 0);
});

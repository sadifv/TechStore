const test = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../models/Product');
const { toPublicProduct } = require('../services/productPricing');
const { normalizeSpecifications } = require('../services/productSpecifications');

test('normalizer distinguishes omission from explicit clearing and accepts multipart JSON', () => {
  assert.equal(normalizeSpecifications(undefined), undefined);
  assert.deepEqual(normalizeSpecifications([]), []);
  assert.deepEqual(normalizeSpecifications('[]'), []);
  const input = [{ name: ' RAM ', value: ' 16 GB ' }];
  assert.deepEqual(normalizeSpecifications(input), [{ name: 'RAM', value: '16 GB' }]);
  assert.deepEqual(input, [{ name: ' RAM ', value: ' 16 GB ' }]);
  assert.deepEqual(normalizeSpecifications(JSON.stringify(input)), [
    { name: 'RAM', value: '16 GB' },
  ]);
});

test('normalizer rejects malformed, nested, unknown, HTML and duplicate inputs without reflecting values', () => {
  for (const raw of [
    '',
    '[',
    'null',
    '{}',
    '"[]"',
    null,
    {},
    1,
    true,
    new Array(1),
    [Object.assign(new Date(), { name: 'RAM', value: '16 GB' })],
    [null],
    [[]],
    [{ name: 'RAM' }],
    [{ name: 'RAM', value: false }],
    [{ name: 'RAM', value: ['nested'] }],
    [{ name: 'RAM', value: 'secret-fixture<b>bad</b>' }],
    [{ name: 'RAM', value: 'ok', extra: 'no' }],
    [{ name: '  ', value: 'x' }],
    [{ name: 'RAM', value: '' }],
    [{ name: 'RAM', value: 'x\u0000y' }],
    [
      { name: 'RAM', value: '1' },
      { name: ' ram ', value: '2' },
    ],
    [
      { name: 'RAM', value: '1' },
      { name: 'ＲＡＭ', value: '2' },
    ],
  ]) {
    assert.throws(
      () => normalizeSpecifications(raw),
      (error) => error.status === 400 && !error.message.includes('secret-fixture'),
    );
  }
});

test('normalizer enforces pair and text boundaries', () => {
  const maximum = Array.from({ length: 20 }, (_, i) => ({
    name: `${i}`.padEnd(40, 'x'),
    value: 'v'.repeat(200),
  }));
  assert.equal(normalizeSpecifications(maximum).length, 20);
  for (const raw of [
    [...maximum, { name: 'extra', value: 'x' }],
    [{ name: 'x'.repeat(41), value: 'x' }],
    [{ name: 'x', value: 'v'.repeat(201) }],
    ' '.repeat(65537),
  ]) {
    assert.throws(() => normalizeSpecifications(raw), { status: 400 });
  }
});

test('public specifications expose only name and value even from aggregation results', () => {
  const result = toPublicProduct({
    specifications: [{ name: 'RAM', value: '16 GB', private: 'hidden' }],
  });
  assert.deepEqual(result.specifications, [{ name: 'RAM', value: '16 GB' }]);
});

test('Product schema rejects invalid specifications without casting nested or scalar values', async () => {
  for (const specifications of [
    null,
    {},
    '[]',
    [{ name: 12, value: 'RAM' }],
    [{ name: 'RAM', value: { nested: true } }],
    [{ name: '', value: '16 GB' }],
    [{ name: 'RAM', value: '<b>16 GB</b>' }],
    [{ name: 'RAM', value: '16 GB', extra: true }],
    [
      { name: 'RAM', value: '1' },
      { name: 'ram', value: '2' },
    ],
    Array.from({ length: 21 }, (_, i) => ({ name: `Spec ${i}`, value: 'yes' })),
  ]) {
    const product = new Product({ name: 'Computer', price: 1, specifications });
    await assert.rejects(product.validate(), /specifications/);
  }
});

test('Product schema preserves valid specifications, clears explicit empty arrays and defaults legacy products', async () => {
  const product = new Product({
    name: 'Computer',
    price: 1,
    specifications: [{ name: ' RAM ', value: '16 GB ' }],
  });
  await product.validate();
  assert.deepEqual(product.toObject().specifications, [{ name: 'RAM', value: '16 GB' }]);
  product.specifications = [];
  await product.validate();
  assert.deepEqual(product.toObject().specifications, []);
  assert.deepEqual(new Product({ name: 'Legacy', price: 1 }).specifications, []);
});

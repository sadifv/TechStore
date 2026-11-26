const { test } = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../models/Product');
const { resolveProductComplements } = require('../services/productComplements');
const { toPublicProduct } = require('../services/productPricing');

test('resolves active complements in editor order and rejects ambiguous or self references', async (t) => {
  const mouse = { _id: '111111111111111111111111', name: 'Ratón' };
  const keyboard = { _id: '222222222222222222222222', name: 'Teclado' };
  let products = [mouse, keyboard];
  t.mock.method(Product, 'find', (query) => {
    assert.equal(query.archivedAt, null);
    return { select: () => ({ limit: () => ({ lean: async () => products }) }) };
  });
  assert.deepEqual(await resolveProductComplements('Teclado\r\nRatón'), [
    { productId: keyboard._id, name: keyboard.name },
    { productId: mouse._id, name: mouse.name },
  ]);
  assert.deepEqual(await resolveProductComplements(''), []);
  assert.equal(await resolveProductComplements(undefined), undefined);
  await assert.rejects(resolveProductComplements('Teclado', keyboard._id), { statusCode: 400 });
  await assert.rejects(resolveProductComplements('Archivado'), { statusCode: 400 });
  products = [mouse, { ...mouse, _id: '333333333333333333333333' }];
  await assert.rejects(resolveProductComplements('Ratón'), { statusCode: 400 });
});

test('updates and clears reasons on existing references without resolving a renamed product', async () => {
  const previous = { productId: '111111111111111111111111', name: 'Ratón', reason: 'Texto previo' };
  const revised = await resolveProductComplements(
    undefined,
    undefined,
    [previous],
    JSON.stringify([{ name: 'Ratón', reason: ' Para navegar sin el panel táctil. ' }]),
  );
  assert.deepEqual(toPublicProduct({ complements: revised }).complements, [
    { ...previous, reason: 'Para navegar sin el panel táctil.' },
  ]);
  assert.deepEqual(await resolveProductComplements('Ratón', undefined, revised), revised);
  assert.deepEqual(
    await resolveProductComplements(undefined, undefined, revised, '[{"name":"Ratón","reason":""}]'),
    [{ name: previous.name, productId: previous.productId }],
  );
});

test('rejects malformed, oversized and ambiguous complement details', async () => {
  for (const body of [
    'null',
    '[{"name":"Ratón","productId":"111111111111111111111111"}]',
    JSON.stringify([{ name: 'Ratón', reason: 'a'.repeat(161) }]),
    JSON.stringify([{ name: 'Ratón', reason: 'texto\nintercalado' }]),
    '[{"name":"Ratón"},{"name":" Ratón "}]',
  ]) {
    await assert.rejects(
      resolveProductComplements(undefined, undefined, undefined, body),
      { statusCode: 400 },
    );
  }
  await assert.rejects(resolveProductComplements('Ratón', undefined, undefined, '[]'), {
    statusCode: 400,
  });
});

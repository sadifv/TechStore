const { test } = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../models/Product');
const { resolveProductComplements } = require('../services/productComplements');

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

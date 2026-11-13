const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePreferences, selectGuidedProducts } = require('../services/guidedShopping');

test('compra guiada rechaza entradas manipuladas y admite presupuesto abierto', () => {
  for (const body of [
    null,
    {},
    { category: { $ne: null }, use: 'jugar', budget: null },
    { category: 'Audio', use: { toString: null }, budget: null },
    ...[-1, 0, Infinity, '100', 100001].map((budget) => ({
      category: 'Audio',
      use: 'musica',
      budget,
    })),
  ])
    assert.equal(validatePreferences(body), null);
  assert.deepEqual(validatePreferences({ category: 'Audio', use: 'musica', budget: null }), {
    category: 'Audio',
    use: 'musica',
    budget: null,
  });
});

test('selección respeta reservas, precio efectivo, presupuesto y datos públicos', () => {
  const base = {
    _id: '1',
    name: 'Audio',
    category: 'Audio',
    price: 100,
    stock: 2,
    specifications: [{ name: 'Micrófono', value: 'Integrado' }],
    secret: 'private',
  };
  const options = [
    base,
    { ...base, _id: '2', stock: 1 },
    {
      ...base,
      _id: '3',
      price: 50,
      flashSale: true,
      flashSaleEndsAt: '2000-01-01',
      originalPrice: 150,
    },
    { ...base, _id: '4', category: 'Cocina y hogar' },
  ];
  const result = selectGuidedProducts(options, new Map([['2', 1]]), {
    category: 'Audio',
    use: 'videollamadas',
    budget: 100,
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].availableStock, 2);
  assert.equal(result[0].secret, undefined);
  assert.ok(result[0].reasons.includes('Micrófono: Integrado'));
  assert.equal(
    selectGuidedProducts(options, new Map(), { category: 'Audio', use: 'musica', budget: 10 })
      .length,
    0,
  );
});

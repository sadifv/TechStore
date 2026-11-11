const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const servicePath = path.join(__dirname, '../services/aiProducts.js');
const originalLoad = Module._load;
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const archivedId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
let query;
const catalog = [
  {
    _id: id,
    name: 'Monitor de prueba',
    price: 100,
    stock: 3,
    privateNote: 'private',
    archivedAt: null,
  },
  { _id: archivedId, name: 'Archivado', price: 50, stock: 4, archivedAt: new Date() },
];
try {
  Module._load = function (request, parent, ...args) {
    if (parent?.filename === servicePath && request === '../models/Product') {
      return {
        find(filter) {
          query = filter;
          return {
            select() {
              return this;
            },
            lean: async () =>
              catalog.filter((p) => p.archivedAt == null && filter._id.$in.includes(p._id)),
          };
        },
      };
    }
    if (parent?.filename === servicePath && request === '../models/Reservation') {
      return { getReservedStockByProducts: async () => new Map([[id, 2]]) };
    }
    return originalLoad.call(this, request, parent, ...args);
  };
  const { findMentionedProductIds, resolveAiProducts } = require(servicePath);

  test('AI product links require a catalog name in the answer and are capped at three', () => {
    assert.deepEqual(findMentionedProductIds('Mira el MONITOR DE PRUEBA.', catalog), [id]);
    assert.deepEqual(findMentionedProductIds('Producto inventado', catalog), []);
    assert.equal(
      findMentionedProductIds(
        'Uno Dos Tres Cuatro',
        ['Uno', 'Dos', 'Tres', 'Cuatro'].map((name, i) => ({ name, _id: i })),
      ).length,
      3,
    );
  });

  test('AI product links reject malformed IDs, exclude archived products and refresh public stock', async () => {
    const products = await resolveAiProducts([id, archivedId, id, 'invalid', { $ne: null }]);
    assert.deepEqual(query, { archivedAt: null, _id: { $in: [id, archivedId] } });
    assert.equal(products.length, 1);
    assert.equal(products[0].availableStock, 1);
    assert.equal(products[0].price, 100);
    assert.equal(products[0].privateNote, undefined);
    catalog[0].price = 125;
    assert.equal((await resolveAiProducts([id]))[0].price, 125);
    catalog[0].archivedAt = new Date();
    assert.deepEqual(await resolveAiProducts([id]), []);
  });
} finally {
  Module._load = originalLoad;
}

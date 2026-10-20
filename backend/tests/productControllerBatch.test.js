const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const controllerPath = path.join(__dirname, '..', 'controllers', 'productController.js');
const originalLoad = Module._load;
const products = [
  { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', stock: 6 },
  { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', stock: 3 },
];
let reservedQueryIds;
const Product = {
  find: () => ({ sort() { return this; }, skip() { return this; }, limit() { return this; }, async lean() { return products; } }),
  countDocuments: async () => products.length,
};
const Reservation = {
  async getReservedStockByProducts(ids) {
    reservedQueryIds = ids;
    return new Map([[String(ids[0]), 2], [String(ids[1]), 7]]);
  },
  async getReservedStock() { throw new Error('The catalog must not query each product separately.'); },
};
const mocks = new Map([
  ['../models/Product', Product],
  ['../models/Reservation', Reservation],
  ['../config/logger', { error() {} }],
]);
Module._load = function (request, parent, isMain) {
  if (parent?.filename === controllerPath && mocks.has(request)) return mocks.get(request);
  return originalLoad.call(this, request, parent, isMain);
};
let getProducts;
try {
  ({ getProducts } = require(controllerPath));
} finally {
  Module._load = originalLoad;
}

test('catalog availability uses one batched reservation query and clamps negative stock', async () => {
  let response;
  await getProducts(
    { query: {} },
    { status() { return this; }, json(value) { response = value; } },
    (error) => { throw error; },
  );
  assert.deepEqual(reservedQueryIds, products.map(({ _id }) => _id));
  assert.deepEqual(response.products.map(({ availableStock }) => availableStock), [4, 0]);
});

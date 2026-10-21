const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const controllerPath = path.join(__dirname, '..', 'controllers', 'productController.js');
const originalLoad = Module._load;
const calls = [];
const products = [{ _id: '1', stock: 5, createdAt: new Date() }];
const saleProduct = { _id: 'sale', flashSale: true, flashSaleEndsAt: new Date(Date.now() + 60_000) };
const Product = {
  find(query) {
    calls.push({ query });
    return {
      select(fields) {
        calls.at(-1).fields = fields;
        return this;
      },
      sort(sort) {
        calls.at(-1).sort = sort;
        return this;
      },
      limit(limit) {
        calls.at(-1).limit = limit;
        return this;
      },
      lean: async () => (query.flashSale ? [saleProduct] : products),
    };
  },
};
const Reservation = { getReservedStockByProducts: async () => new Map() };
Module._load = function (request, parent, isMain) {
  if (parent?.filename === controllerPath && request === '../models/Product') return Product;
  if (parent?.filename === controllerPath && request === '../models/Reservation')
    return Reservation;
  if (parent?.filename === controllerPath && request === '../config/logger') return { error() {} };
  return originalLoad.call(this, request, parent, isMain);
};
let getHomeProducts;
try {
  ({ getHomeProducts } = require(controllerPath));
} finally {
  Module._load = originalLoad;
}

test('home API returns at most eight recent products and the soonest active sale', async () => {
  assert.equal(typeof getHomeProducts, 'function');
  let response;
  await getHomeProducts(
    { query: {} },
    {
      status() {
        return this;
      },
      json(value) {
        response = value;
      },
    },
    (error) => {
      throw error;
    },
  );
  assert.deepEqual(response.products, [{ ...products[0], availableStock: 5 }]);
  assert.equal(calls[0].limit, 8);
  assert.deepEqual(calls[0].sort, { createdAt: -1 });
  assert.equal(calls[1].query.flashSale, true);
  assert.ok(calls[1].query.flashSaleEndsAt.$gt instanceof Date);
  assert.deepEqual(calls[1].sort, { flashSaleEndsAt: 1 });
  assert.equal(calls[1].limit, 1);
  assert.ok(calls.every((call) => call.fields.includes('name') && !call.fields.includes('description')));
  assert.deepEqual(response.flashSale, saleProduct);
});

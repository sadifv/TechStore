const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const controllerPath = path.join(__dirname, '..', 'controllers', 'productController.js');
const originalLoad = Module._load;
const calls = [];
const products = [
  { _id: '1', category: 'Laptops', stock: 5 },
  { _id: '2', category: 'Laptops', stock: 3 },
  { _id: '3', category: 'Laptops', stock: 1 },
  { _id: '4', category: 'Laptops', stock: 2 },
  { _id: '5', category: 'Audio', stock: 3 },
  { _id: '6', category: 'Periféricos', stock: 4 },
];
const categoryImages = [{ _id: 'Smartphones', image: '/uploads/phone.jpg' }];
const saleProduct = {
  _id: 'sale',
  flashSale: true,
  flashSaleEndsAt: new Date(Date.now() + 60_000),
};
const Product = {
  aggregate: async () => categoryImages,
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
const Reservation = { getReservedStockByProducts: async () => new Map([['1', 5]]) };
let categorySettings = { categories: ['Laptops', 'Audio', 'Periféricos'].map((name, i) => ({ id: `category-${i * 2 + 1}`, name })) };
Module._load = function (request, parent, isMain) {
  if (parent?.filename === controllerPath && request === '../services/storeCategories')
    return { getCategorySettings: async () => categorySettings };
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

test('home API excludes fully reserved stock, diversifies featured products and keeps the active sale', async () => {
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
  assert.deepEqual(
    response.products.map((product) => product._id),
    ['2', '5', '6', '3'],
  );
  assert.ok(response.products.every((product) => product.availableStock > 0));
  assert.equal(calls[0].limit, undefined);
  assert.deepEqual(calls[0].sort, { createdAt: -1, _id: 1 });
  assert.deepEqual(calls[0].query.category.$in, ['Laptops', 'Audio', 'Periféricos']);
  assert.deepEqual(calls[0].query.stock, { $gt: 0 });
  assert.deepEqual(response.categoryImages, categoryImages);
  assert.equal(calls[1].query.flashSale, true);
  assert.ok(calls[1].query.flashSaleEndsAt.$gt instanceof Date);
  assert.deepEqual(calls[1].sort, { flashSaleEndsAt: 1 });
  assert.equal(calls[1].limit, 1);
  assert.ok(calls.every((call) => call.fields.includes('name')));
  assert.ok(calls[1].fields.includes('description'));
  assert.equal(calls[0].query.archivedAt, null);
  assert.deepEqual(response.flashSale, saleProduct);
});

test('home selection follows renamed categories by stable identity', async () => {
  categorySettings = { categories: [{ id: 'category-1', name: 'Portátiles' }] };
  calls.length = 0;
  await getHomeProducts({ query: {} }, { status() { return this; }, json() {} }, error => { throw error; });
  assert.deepEqual(calls[0].query.category.$in, ['Portátiles']);
});

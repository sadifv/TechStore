import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeHomeProducts } from './homeProducts.js';

test('normalizes the home endpoint contract and caps featured products at eight', () => {
  const products = Array.from({ length: 10 }, (_, index) => ({ _id: String(index) }));
  const sale = { _id: 'sale' };
  assert.deepEqual(normalizeHomeProducts({ products, flashSale: sale }), {
    products: products.slice(0, 8), flashSale: sale,
  });
  assert.deepEqual(normalizeHomeProducts(null), { products: [], flashSale: null });
});

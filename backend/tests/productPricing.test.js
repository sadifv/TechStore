const test = require('node:test');
const assert = require('node:assert/strict');
const { getEffectivePrice, toPublicProduct } = require('../services/productPricing');
const { activeProductFilter, isProductArchived } = require('../services/productAvailability');
test('expired sale uses its original price immediately without cron and preserves input', () => {
  const product = {
    price: 50,
    originalPrice: 100,
    flashSale: true,
    flashSaleEndsAt: new Date(100),
  };
  assert.equal(getEffectivePrice(product, 200), 100);
  assert.equal(getEffectivePrice(product, 50), 50);
  assert.equal(getEffectivePrice({ ...product, originalPrice: 0 }, 200), 0);
  assert.equal(getEffectivePrice({ ...product, originalPrice: null }, 200), 50);
  assert.equal(toPublicProduct(product, 200).flashSale, false);
  assert.equal(product.price, 50);
});
test('legacy products remain visible while archived products are unavailable', () => {
  assert.deepEqual(activeProductFilter(), { archivedAt: null });
  assert.equal(isProductArchived({}), false);
  assert.equal(isProductArchived({ archivedAt: new Date() }), true);
});

test('public products exclude internal fields even when aggregation bypasses schema selection', () => {
  const product = {
    _id: 'product-test',
    name: 'Public product',
    price: 10,
    stock: 3,
    availableStock: 2,
    inventoryRestorationKeys: ['private-order'],
    reservationLockToken: 'test-only-lock',
    reservationLockExpiresAt: new Date(),
    futurePrivateField: 'private',
    __v: 2,
  };
  assert.deepEqual(toPublicProduct(product), {
    _id: product._id,
    name: product.name,
    price: 10,
    stock: 3,
    availableStock: 2,
  });
  assert.deepEqual(product.inventoryRestorationKeys, ['private-order']);
});

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

import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrderItemName } from './orderItemDisplay.js';
test('order history prefers the purchased snapshot after rename or deletion', () => {
  assert.equal(getOrderItemName({ productName: 'Purchased name', product: { name: 'Renamed' } }), 'Purchased name');
  assert.equal(getOrderItemName({ productName: 'Purchased name', product: null }), 'Purchased name');
  assert.equal(getOrderItemName({ product: { name: 'Legacy' } }), 'Legacy');
  assert.equal(getOrderItemName({}), 'Producto no disponible');
});

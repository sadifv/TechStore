import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUEST_CART_KEY, syncGuestCartToUser } from '../../../src/features/cart/guestCart.js';

function storageFor(items) {
  const values = new Map([[GUEST_CART_KEY, JSON.stringify(items)]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const response = (data) => ({
  ok: true,
  headers: new Headers({ 'Content-Type': 'application/json' }),
  json: async () => ({ success: true, ...data }),
});

test('guest synchronization includes account cookies and removes only confirmed items', async () => {
  const storage = storageFor([{ id: 'product', quantity: 2 }]);
  const fetcher = async (url, options) => {
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers.get('Accept'), 'application/json');
    if (url === '/api/cart') return response({ items: [] });
    assert.equal(url, '/api/cart/add');
    assert.deepEqual(JSON.parse(options.body), { productId: 'product', quantity: 2 });
    return response({});
  };
  assert.deepEqual(await syncGuestCartToUser(fetcher, storage), { syncedCount: 1, failedCount: 0 });
  assert.equal(storage.getItem(GUEST_CART_KEY), null);
});

test('a lost add response is reconciled without adding the same quantity twice', async () => {
  const storage = storageFor([{ id: 'product', quantity: 2 }]);
  let quantity = 1;
  let writes = 0;
  const fetcher = async (url, options) => {
    assert.equal(options.credentials, 'include');
    if (url === '/api/cart') return response({ items: [{ product: 'product', quantity }] });
    writes += 1;
    quantity += 2;
    throw new Error('Lost response');
  };
  assert.deepEqual(await syncGuestCartToUser(fetcher, storage), { syncedCount: 1, failedCount: 0 });
  assert.equal(writes, 1);
  assert.equal(storage.getItem(GUEST_CART_KEY), null);
});

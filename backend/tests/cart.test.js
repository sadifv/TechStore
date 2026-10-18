const assert = require('node:assert/strict');
const test = require('node:test');

const GUEST_CART_KEY = 'techstore_guest_cart';
const createStorage = (items = []) => {
    const values = new Map();
    if (items.length) values.set(GUEST_CART_KEY, JSON.stringify(items));
    return {
        getItem: key => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
};

test('removes only purchased guest-cart quantities after a confirmed checkout', async () => {
    const { removePurchasedGuestCartItems, readGuestCart } = await import('../../frontend/src/guestCart.js');
    const storage = createStorage([
        { id: 'product-a', quantity: 5 },
        { id: 'product-b', quantity: 2 }
    ]);

    removePurchasedGuestCartItems([
        { productId: 'product-a', quantity: 3 },
        { productId: 'product-b', quantity: 2 }
    ], storage);

    assert.deepEqual(readGuestCart(storage), [{ id: 'product-a', quantity: 2 }]);
});

test('ignores invalid purchased quantities and preserves the guest cart', async () => {
    const { removePurchasedGuestCartItems, readGuestCart } = await import('../../frontend/src/guestCart.js');
    const initialCart = [{ id: 'product-a', quantity: 2 }];
    const storage = createStorage(initialCart);

    removePurchasedGuestCartItems([
        { productId: 'product-a', quantity: 0 },
        { productId: 'product-a', quantity: 1.5 },
        { quantity: 2 }
    ], storage);

    assert.deepEqual(readGuestCart(storage), initialCart);
});

test('keeps failed products in the guest cart when account-cart synchronization is partial', async () => {
    const { readGuestCart, syncGuestCartToUser } = await import('../../frontend/src/guestCart.js');
    const fetchMock = async (url, options = {}) => {
        if (url === '/api/cart' && !options.method) {
            return { ok: true, json: async () => ({ success: true, items: [] }) };
        }
        if (url === '/api/cart/add') {
            const productId = JSON.parse(options.body).productId;
            if (productId === 'product-a') return { ok: true, json: async () => ({ success: true }) };
            return { ok: false, json: async () => ({ success: false, error: 'Stock insuficiente' }) };
        }
        if (url === '/api/cart') {
            return { ok: true, json: async () => ({ success: true, items: [{ product: 'product-a', quantity: 2 }] }) };
        }
        throw new Error(`Unexpected request: ${url}`);
    };
    const storage = createStorage([
        { id: 'product-a', quantity: 2 },
        { id: 'product-b', quantity: 1 }
    ]);

    const result = await syncGuestCartToUser(fetchMock, storage);

    assert.equal(result.syncedCount, 1);
    assert.equal(result.failedCount, 1);
    assert.deepEqual(readGuestCart(storage), [{ id: 'product-b', quantity: 1 }]);
});

test('retains all guest-cart products if the account cart cannot be read', async () => {
    const { readGuestCart, syncGuestCartToUser } = await import('../../frontend/src/guestCart.js');
    const guestCart = [{ id: 'product-a', quantity: 2 }];
    const storage = createStorage(guestCart);
    const result = await syncGuestCartToUser(async () => { throw new Error('network unavailable'); }, storage);

    assert.equal(result.syncedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.deepEqual(readGuestCart(storage), guestCart);
});

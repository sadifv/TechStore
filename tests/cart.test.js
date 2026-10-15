const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const cartScript = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'cart.js'),
    'utf8'
);

const loadCartScript = (initialCart = [], fetchMock) => {
    const storage = new Map();
    if (initialCart.length > 0) {
        storage.set('techstore_guest_cart', JSON.stringify(initialCart));
    }

    const windowEvents = [];
    const window = {
        dispatchEvent: event => windowEvents.push(event.type),
        addEventListener() {}
    };
    const context = {
        window,
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key)
        },
        document: { addEventListener() {} },
        CustomEvent: class {
            constructor(type) {
                this.type = type;
            }
        },
        fetch: fetchMock || (async () => {
            throw new Error('fetch should not be used by these tests');
        }),
        console: { error() {} }
    };
    vm.runInNewContext(cartScript, context, { filename: 'cart.js' });

    return {
        cart: () => {
            const value = storage.get('techstore_guest_cart');
            return value ? JSON.parse(value) : [];
        },
        events: windowEvents,
        window
    };
};

test('removes only purchased guest-cart quantities after a confirmed checkout', () => {
    const app = loadCartScript([
        { id: 'product-a', quantity: 5 },
        { id: 'product-b', quantity: 2 }
    ]);

    app.window.removeGuestCartItemsAfterPurchase([
        { productId: 'product-a', quantity: 3 },
        { productId: 'product-b', quantity: 2 }
    ]);

    assert.deepEqual(app.cart(), [{ id: 'product-a', quantity: 2 }]);
    assert.deepEqual(app.events, ['guest-cart:reconciled']);
});

test('ignores invalid purchased quantities and preserves the guest cart', () => {
    const initialCart = [{ id: 'product-a', quantity: 2 }];
    const app = loadCartScript(initialCart);

    app.window.removeGuestCartItemsAfterPurchase([
        { productId: 'product-a', quantity: 0 },
        { productId: 'product-a', quantity: 1.5 },
        { quantity: 2 }
    ]);

    assert.deepEqual(app.cart(), initialCart);
    assert.deepEqual(app.events, ['guest-cart:reconciled']);
});

test('keeps failed products in the guest cart when account-cart synchronization is partial', async () => {
    const fetchMock = async (url, options = {}) => {
        if (url === '/api/cart' && !options.method) {
            return {
                ok: true,
                json: async () => ({ success: true, items: [] })
            };
        }
        if (url === '/api/cart/add') {
            const productId = JSON.parse(options.body).productId;
            if (productId === 'product-a') {
                return { ok: true, json: async () => ({ success: true }) };
            }
            return {
                ok: false,
                json: async () => ({ success: false, error: 'Stock insuficiente' })
            };
        }
        if (url === '/api/cart') {
            return {
                ok: true,
                json: async () => ({
                    success: true,
                    items: [{ product: 'product-a', quantity: 2 }]
                })
            };
        }
        throw new Error(`Unexpected request: ${url}`);
    };
    const app = loadCartScript([
        { id: 'product-a', quantity: 2 },
        { id: 'product-b', quantity: 1 }
    ], fetchMock);

    const result = await app.window.syncGuestCartToUser();

    assert.equal(result.syncedCount, 1);
    assert.equal(result.failedCount, 1);
    assert.deepEqual(app.cart(), [{ id: 'product-b', quantity: 1 }]);
});

test('retains all guest-cart products if the account cart cannot be read', async () => {
    const guestCart = [{ id: 'product-a', quantity: 2 }];
    const app = loadCartScript(guestCart, async () => {
        throw new Error('network unavailable');
    });

    const result = await app.window.syncGuestCartToUser();

    assert.equal(result.syncedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.deepEqual(app.cart(), guestCart);
});

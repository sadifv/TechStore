const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const {
    addOrder,
    addProduct,
    reset,
    sendWebhook,
    state,
    controller
} = require('./helpers/orderControllerHarness');

beforeEach(reset);

test('retries an incomplete inventory restoration without duplicating completed increments', async () => {
    const order = addOrder({
        items: [
            { product: 'product-a', quantity: 2, inventoryReserved: true },
            { product: 'product-b', quantity: 1, inventoryReserved: true }
        ]
    });
    addProduct('product-a', 4);
    addProduct('product-b', 7);
    state.failProductUpdates.set('product-b', 1);
    const expiredSession = { metadata: { orderId: order._id } };

    const firstAttempt = await sendWebhook('checkout.session.expired', expiredSession);
    assert.equal(firstAttempt.statusCode, 500);
    assert.equal(state.products.get('product-a').stock, 6);
    assert.equal(state.products.get('product-b').stock, 7);
    assert.equal(order.inventoryRestored, false);

    const retry = await sendWebhook('checkout.session.expired', expiredSession);
    assert.equal(retry.statusCode, 200);
    assert.equal(state.products.get('product-a').stock, 6);
    assert.equal(state.products.get('product-b').stock, 8);
    assert.equal(order.inventoryRestored, true);

    const duplicate = await sendWebhook('checkout.session.expired', expiredSession);
    assert.equal(duplicate.statusCode, 200);
    assert.equal(state.products.get('product-a').stock, 6);
    assert.equal(state.products.get('product-b').stock, 8);
});

test('marks a confirmed Stripe payment as paid and clears only the unchanged account cart', async () => {
    const snapshotUpdatedAt = new Date('2026-10-14T12:00:00.000Z');
    const order = addOrder({
        user: 'user-1',
        cartSnapshotUpdatedAt: snapshotUpdatedAt,
        items: [{ product: 'product-a', quantity: 2 }]
    });
    const cartItems = [{ product: 'product-a', quantity: 2 }];
    state.cart = {
        _id: 'cart-1',
        updatedAt: new Date(snapshotUpdatedAt),
        items: cartItems
    };

    const response = await sendWebhook('checkout.session.completed', {
        metadata: { orderId: order._id }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(order.paymentStatus, 'paid');
    assert.equal(order.status, 'processing');
    assert.deepEqual(state.cart.items, []);
});

test('preserves account-cart changes made after checkout began', async () => {
    const snapshotUpdatedAt = new Date('2026-10-14T12:00:00.000Z');
    const order = addOrder({
        user: 'user-1',
        cartSnapshotUpdatedAt: snapshotUpdatedAt,
        items: [{ product: 'product-a', quantity: 2 }]
    });
    state.cart = {
        _id: 'cart-1',
        updatedAt: new Date(snapshotUpdatedAt.getTime() + 1000),
        items: [
            { product: 'product-a', quantity: 2 },
            { product: 'product-b', quantity: 1 }
        ]
    };

    const response = await sendWebhook('checkout.session.completed', {
        metadata: { orderId: order._id }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(order.paymentStatus, 'paid');
    assert.deepEqual(state.cart.items, [
        { product: 'product-a', quantity: 2 },
        { product: 'product-b', quantity: 1 }
    ]);
});

test('expires a stale open Stripe checkout and restores its inventory', async () => {
    const order = addOrder({
        stripeSessionId: 'cs-expired',
        items: [{ product: 'product-a', quantity: 3, inventoryReserved: true }]
    });
    addProduct('product-a', 2);
    state.expiredOrders = [order];
    state.stripeSessions.set('cs-expired', {
        id: 'cs-expired',
        status: 'open',
        payment_status: 'unpaid',
        metadata: { orderId: order._id }
    });

    const reconciled = await controller.reconcileExpiredOrders();

    assert.equal(reconciled, 1);
    assert.equal(state.stripeSessions.get('cs-expired').status, 'expired');
    assert.equal(state.products.get('product-a').stock, 5);
    assert.equal(order.paymentStatus, 'failed');
    assert.equal(order.inventoryRestored, true);
});

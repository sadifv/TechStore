const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const {
    addOrder,
    addCoupon,
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
    assert.equal(state.restorationKeys.get('product-a').size, 0);
    assert.equal(state.restorationKeys.get('product-b').size, 0);

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

test('releases a coupon reservation once and retries if saving the order status fails', async () => {
    const order = addOrder({
        coupon: 'coupon-1',
        couponReservationStatus: 'reserved',
        items: [{ product: 'product-a', quantity: 2, inventoryReserved: true }]
    });
    const coupon = addCoupon('coupon-1');
    coupon.reservationOrderIds.add(order._id);
    addProduct('product-a', 5);
    state.failCouponStatusUpdateOnce = 1;
    const expiredSession = { metadata: { orderId: order._id } };

    const firstAttempt = await sendWebhook('checkout.session.expired', expiredSession);
    assert.equal(firstAttempt.statusCode, 500);
    assert.equal(coupon.redemptionCount, 0);
    assert.equal(order.couponReservationStatus, 'reserved');
    assert.equal(order.inventoryRestored, false);

    const retry = await sendWebhook('checkout.session.expired', expiredSession);
    assert.equal(retry.statusCode, 200);
    assert.equal(coupon.redemptionCount, 0);
    assert.equal(order.couponReservationStatus, 'released');
    assert.equal(order.inventoryRestored, true);
    assert.equal(state.products.get('product-a').stock, 7);
});

test('serializes duplicate expiry webhooks while pruning completed restoration keys', async () => {
    const order = addOrder({
        items: [{ product: 'product-a', quantity: 2, inventoryReserved: true }]
    });
    addProduct('product-a', 3);
    const expiredSession = { metadata: { orderId: order._id } };

    const responses = await Promise.all([
        sendWebhook('checkout.session.expired', expiredSession),
        sendWebhook('checkout.session.expired', expiredSession)
    ]);

    assert.deepEqual(responses.map(response => response.statusCode), [200, 200]);
    assert.equal(state.products.get('product-a').stock, 5);
    assert.equal(order.inventoryRestored, true);
    assert.equal(state.restorationKeys.get('product-a').size, 0);
});

test('retries cleanup of restoration keys if the first cleanup write fails', async () => {
    const order = addOrder({
        items: [{ product: 'product-a', quantity: 2, inventoryReserved: true }]
    });
    addProduct('product-a', 3);
    state.failMarkerCleanup = 1;
    const expiredSession = { metadata: { orderId: order._id } };

    const response = await sendWebhook('checkout.session.expired', expiredSession);
    assert.equal(response.statusCode, 200);
    assert.equal(order.inventoryRestored, true);
    assert.equal(order.inventoryRestorationKeysPruned, false);
    assert.equal(state.restorationKeys.get('product-a').size, 1);

    state.unprunedOrders = [order];
    const pruned = await controller.pruneCompletedInventoryRestorationKeys();

    assert.equal(pruned, 1);
    assert.equal(order.inventoryRestorationKeysPruned, true);
    assert.equal(state.restorationKeys.get('product-a').size, 0);
});

test('continues pruning other orders when one order cannot acquire product locks', async () => {
    const blockedOrder = addOrder({
        _id: 'order-blocked',
        paymentStatus: 'failed',
        inventoryRestored: true,
        items: [{ product: 'product-a', quantity: 1, inventoryReserved: true }]
    });
    const nextOrder = addOrder({
        _id: 'order-next',
        paymentStatus: 'failed',
        inventoryRestored: true,
        items: [{ product: 'product-b', quantity: 1, inventoryReserved: true }]
    });
    addProduct('product-a', 4);
    addProduct('product-b', 5);
    state.restorationKeys.get('product-a').add('order-blocked:product-a');
    state.restorationKeys.get('product-b').add('order-next:product-b');
    state.failProductLocks.add('product-a');
    state.unprunedOrders = [blockedOrder, nextOrder];

    const pruned = await controller.pruneCompletedInventoryRestorationKeys();

    assert.equal(pruned, 1);
    assert.equal(blockedOrder.inventoryRestorationKeysPruned, false);
    assert.equal(state.restorationKeys.get('product-a').has('order-blocked:product-a'), true);
    assert.equal(nextOrder.inventoryRestorationKeysPruned, true);
    assert.equal(state.restorationKeys.get('product-b').size, 0);
});

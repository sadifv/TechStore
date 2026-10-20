const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const {
  addOrder,
  addCoupon,
  addProduct,
  reset,
  confirmPayment,
  expireOrders,
  state,
  controller,
} = require('./helpers/orderControllerHarness');

beforeEach(reset);

test('reintenta una restitución parcial de inventario sin duplicar incrementos', async () => {
  const order = addOrder({
    items: [
      { product: 'product-a', quantity: 2, inventoryReserved: true },
      { product: 'product-b', quantity: 1, inventoryReserved: true },
    ],
  });
  addProduct('product-a', 4);
  addProduct('product-b', 7);
  state.failProductUpdates.set('product-b', 1);

  assert.equal(await expireOrders(order), 0);
  assert.equal(state.products.get('product-a').stock, 6);
  assert.equal(state.products.get('product-b').stock, 7);
  assert.equal(order.inventoryRestored, false);

  assert.equal(await expireOrders(order), 1);
  assert.equal(state.products.get('product-a').stock, 6);
  assert.equal(state.products.get('product-b').stock, 8);
  assert.equal(order.inventoryRestored, true);
  assert.equal(state.restorationKeys.get('product-a').size, 0);
  assert.equal(state.restorationKeys.get('product-b').size, 0);
  assert.equal(await expireOrders(order), 0);
  assert.equal(state.products.get('product-a').stock, 6);
  assert.equal(state.products.get('product-b').stock, 8);
});

test('el administrador confirma el pago y limpia solo el carrito que no cambió', async () => {
  const snapshotUpdatedAt = new Date('2026-10-14T12:00:00.000Z');
  const order = addOrder({
    user: 'user-1',
    cartSnapshotUpdatedAt: snapshotUpdatedAt,
    items: [{ product: 'product-a', quantity: 2 }],
  });
  state.cart = {
    _id: 'cart-1',
    updatedAt: new Date(snapshotUpdatedAt),
    items: [{ product: 'product-a', quantity: 2 }],
  };

  const response = await confirmPayment(order);
  assert.equal(response.statusCode, 200);
  assert.equal(order.paymentStatus, 'paid');
  assert.equal(order.status, 'processing');
  assert.deepEqual(state.cart.items, []);
});

test('preserva cambios del carrito posteriores al pedido', async () => {
  const snapshotUpdatedAt = new Date('2026-10-14T12:00:00.000Z');
  const order = addOrder({
    user: 'user-1',
    cartSnapshotUpdatedAt: snapshotUpdatedAt,
    items: [{ product: 'product-a', quantity: 2 }],
  });
  state.cart = {
    _id: 'cart-1',
    updatedAt: new Date(snapshotUpdatedAt.getTime() + 1000),
    items: [
      { product: 'product-a', quantity: 2 },
      { product: 'product-b', quantity: 1 },
    ],
  };

  const response = await confirmPayment(order);
  assert.equal(response.statusCode, 200);
  assert.equal(order.paymentStatus, 'paid');
  assert.deepEqual(state.cart.items, [
    { product: 'product-a', quantity: 2 },
    { product: 'product-b', quantity: 1 },
  ]);
});

test('vence un pedido de WhatsApp pendiente y devuelve su inventario', async () => {
  const order = addOrder({
    items: [{ product: 'product-a', quantity: 3, inventoryReserved: true }],
  });
  addProduct('product-a', 2);

  assert.equal(await expireOrders(order), 1);
  assert.equal(state.products.get('product-a').stock, 5);
  assert.equal(order.paymentStatus, 'failed');
  assert.equal(order.inventoryRestored, true);
});

test('libera la reserva de cupón al vencer el pedido y permite reintentar', async () => {
  const order = addOrder({
    coupon: 'coupon-1',
    couponReservationStatus: 'reserved',
    items: [{ product: 'product-a', quantity: 2, inventoryReserved: true }],
  });
  const coupon = addCoupon('coupon-1');
  coupon.reservationOrderIds.add(order._id);
  addProduct('product-a', 5);
  state.failCouponStatusUpdateOnce = 1;

  assert.equal(await expireOrders(order), 0);
  assert.equal(coupon.redemptionCount, 0);
  assert.equal(order.couponReservationStatus, 'reserved');
  assert.equal(order.inventoryRestored, false);

  assert.equal(await expireOrders(order), 1);
  assert.equal(coupon.redemptionCount, 0);
  assert.equal(order.couponReservationStatus, 'released');
  assert.equal(order.inventoryRestored, true);
  assert.equal(state.products.get('product-a').stock, 7);
});

test('serializa vencimientos duplicados y limpia claves de restitución', async () => {
  const order = addOrder({
    items: [{ product: 'product-a', quantity: 2, inventoryReserved: true }],
  });
  addProduct('product-a', 3);

  await Promise.all([expireOrders(order), expireOrders(order)]);
  assert.equal(state.products.get('product-a').stock, 5);
  assert.equal(order.inventoryRestored, true);
  assert.equal(state.restorationKeys.get('product-a').size, 0);
});

test('reintenta limpiar claves de inventario si falla la primera limpieza', async () => {
  const order = addOrder({
    items: [{ product: 'product-a', quantity: 2, inventoryReserved: true }],
  });
  addProduct('product-a', 3);
  state.failMarkerCleanup = 1;

  assert.equal(await expireOrders(order), 1);
  assert.equal(order.inventoryRestored, true);
  assert.equal(order.inventoryRestorationKeysPruned, false);
  assert.equal(state.restorationKeys.get('product-a').size, 1);

  state.unprunedOrders = [order];
  assert.equal(await controller.pruneCompletedInventoryRestorationKeys(), 1);
  assert.equal(order.inventoryRestorationKeysPruned, true);
  assert.equal(state.restorationKeys.get('product-a').size, 0);
});

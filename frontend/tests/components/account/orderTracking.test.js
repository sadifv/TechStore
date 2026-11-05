import test from 'node:test';
import assert from 'node:assert/strict';
test('expiry is preserved after maintenance cancelled the order', () => {
  assert.equal(
    orderShippingLabel({ status: 'cancelled', paymentStatus: 'failed', expired: true }),
    'Vencido',
  );
});
import {
  orderPaymentLabel,
  orderShippingLabel,
  orderEventLabel,
  requestOrderUpdate,
} from '../../../src/components/account/orderTracking.js';

test('tracking separates payment from shipping and distinguishes cancelled and expired orders', () => {
  assert.equal(orderPaymentLabel({ paymentStatus: 'paid', status: 'shipped' }), 'Pago confirmado');
  assert.equal(orderShippingLabel({ paymentStatus: 'paid', status: 'shipped' }), 'Enviado');
  assert.equal(
    orderShippingLabel({ paymentStatus: 'pending', status: 'pending' }),
    'Pendiente de pago',
  );
  assert.equal(orderShippingLabel({ status: 'cancelled' }), 'Cancelado');
  assert.equal(orderShippingLabel({ status: 'pending', expired: true }), 'Vencido');
  assert.equal(orderEventLabel('customer_cancelled'), 'Cancelaste el pedido');
  assert.equal(orderEventLabel('inventory_product_missing'), null);
});
test('tracking sends guest capability only in JSON and failed cancellation remains an error', async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    return { success: true, data: { status: 'cancelled' } };
  };
  assert.equal(
    (await requestOrderUpdate('cancel', 'order', 'private', request)).status,
    'cancelled',
  );
  assert.equal(calls[0].url, '/api/orders/cancel');
  assert.deepEqual(JSON.parse(calls[0].options.body), { orderId: 'order', checkoutKey: 'private' });
  await assert.rejects(
    requestOrderUpdate('cancel', 'order', null, async () => {
      throw new Error('Sin conexión');
    }),
    /Sin conexión/,
  );
});

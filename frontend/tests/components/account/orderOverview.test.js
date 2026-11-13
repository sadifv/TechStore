import test from 'node:test';
import assert from 'node:assert/strict';
import { isPreviousOrder, orderNextStep } from '../../../src/components/account/orderOverview.js';

test('separa pedidos finalizados de los pendientes sin confundir pago y contacto', () => {
  for (const status of ['cancelled', 'delivered', 'completed']) assert.equal(isPreviousOrder({ status }), true);
  assert.equal(isPreviousOrder({ expired: true }), true);
  assert.equal(isPreviousOrder({ status: 'processing', paymentStatus: 'paid' }), false);
  assert.match(orderNextStep({ status: 'pending' }), /envía el mensaje/);
  assert.match(orderNextStep({ contactConfirmedAt: '2026-11-12' }), /confirmación/);
  assert.match(orderNextStep({ paymentStatus: 'paid', status: 'shipped' }), /enviado/);
  assert.match(orderNextStep({ status: 'cancelled' }), /cancelado/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutAddressPayload } from './checkoutAddress.js';
test('checkout shares only the chosen address, never stale or saved address details', () => {
  const form = new FormData();
  form.set('addressMode', 'none');
  form.set('street', 'private');
  assert.deepEqual(checkoutAddressPayload(form), {});
  form.set('addressMode', 'saved');
  form.set('savedAddressId', 'a'.repeat(24));
  assert.deepEqual(checkoutAddressPayload(form), { savedAddressId: 'a'.repeat(24) });
  form.set('addressMode', 'manual');
  form.set('recipient', 'Cliente');
  form.set('city', 'Guayaquil');
  form.set('country', 'Ecuador');
  const result = checkoutAddressPayload(form);
  assert.equal(result.savedAddressId, undefined);
  assert.equal(result.shippingAddress.street, 'private');
});

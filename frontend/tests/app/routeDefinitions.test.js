import test from 'node:test';
import assert from 'node:assert/strict';
import { matchRoute } from '../../src/app/routeDefinitions.js';

test('keeps public and administrative route aliases and trailing slashes', () => {
  for (const path of ['/admin', '/admin/dashboard', '/admin/dashboard/'])
    assert.equal(matchRoute(path).name, 'dashboard');
  for (const path of [
    '/api/marketing/unsubscribe',
    '/marketing/unsubscribe',
    '/newsletter/unsubscribe/token',
    '/api/newsletter/unsubscribe/token',
  ])
    assert.equal(matchRoute(path).name, 'unsubscribe');
  assert.equal(matchRoute('/profile').name, 'profile');
  assert.equal(matchRoute('/admin/audit').name, 'audit');
  assert.equal(matchRoute('/avisos/confirmar').name, 'restock');
  assert.equal(matchRoute('/avisos/baja').name, 'restock');
  assert.equal(matchRoute('/toString').name, 'notFound');
});
test('decodes dynamic parameters safely and preserves standalone packing-slip layout', () => {
  assert.equal(matchRoute('/producto/a%20b').parameter, 'a b');
  assert.equal(matchRoute('/reset-password/token').name, 'reset');
  assert.equal(matchRoute('/admin/orders/id').name, 'order');
  assert.equal(matchRoute('/admin/orders/id/packing-slip').standalone, true);
  assert.equal(matchRoute('/admin/orders/%ZZ/packing-slip').name, 'notFound');
  assert.equal(matchRoute('/admin/orders/%ZZ/packing-slip').standalone, true);
  for (const path of [
    '/producto/%',
    '/reset-password/%ZZ',
    '/newsletter/unsubscribe/%ZZ',
    '/admin/orders/%ZZ',
  ])
    assert.equal(matchRoute(path).name, 'notFound');
  assert.equal(matchRoute('/producto/id/extra').name, 'notFound');
});

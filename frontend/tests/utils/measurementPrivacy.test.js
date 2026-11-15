import test from 'node:test';
import assert from 'node:assert/strict';
import {
  measurementPath,
  safeMeasurementEvent,
  safeMeasurementReferrer,
} from '../../src/utils/measurementPrivacy.js';

const origin = 'https://store.example.test';
test('telemetry strips queries, hashes and arbitrary routes, grouping public products', () => {
  const input = {
    type: 'vital',
    url: `${origin}/catalogo?q=private@example.test#token`,
    route: '/admin/users/private',
  };
  assert.deepEqual(safeMeasurementEvent(input, origin), {
    type: 'vital',
    url: `${origin}/catalogo`,
    route: '/catalogo',
  });
  assert.equal(input.route, '/admin/users/private');
  assert.equal(
    safeMeasurementEvent(
      { type: 'pageview', url: `${origin}/producto/aaaaaaaaaaaaaaaaaaaaaaaa?token=secret` },
      origin,
    ).url,
    `${origin}/producto/[id]`,
  );
});
test('only allowlisted public pages and documented event types can be measured', () => {
  for (const path of [
    '/admin',
    '/admin/users',
    '/profile',
    '/login',
    '/register',
    '/pedido-enviado',
    '/reset-password/secret',
    '/avisos/baja?token=secret',
    '/newsletter/unsubscribe/secret',
    '/unknown/private@example.test',
    '/producto/private@example.test',
  ]) {
    assert.equal(
      safeMeasurementEvent({ type: 'pageview', url: origin + path }, origin),
      null,
      path,
    );
  }
  for (const url of [
    'https://other.test/catalogo',
    'invalid',
    'https://user:pass@store.example.test/catalogo',
  ])
    assert.equal(safeMeasurementEvent({ type: 'vital', url }, origin), null);
  assert.equal(safeMeasurementEvent({ type: 'event', url: origin, name: 'private' }, origin), null);
  assert.equal(measurementPath('/catalogo'), '/catalogo');
});
test('sensitive or malformed referrers suppress measurement entirely', () => {
  assert.equal(safeMeasurementReferrer('', origin), true);
  assert.equal(safeMeasurementReferrer(origin + '/catalogo', origin), true);
  assert.equal(safeMeasurementReferrer('https://search.example/', origin), true);
  for (const referrer of [
    origin + '/profile',
    origin + '/catalogo?q=private',
    origin + '/reset-password/token',
    'https://other.test/private/person',
    'bad-url',
  ])
    assert.equal(safeMeasurementReferrer(referrer, origin), false);
});

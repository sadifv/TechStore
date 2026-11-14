const test = require('node:test');
const assert = require('node:assert/strict');
const { defaults, normalizeDefinition, mergeDefinitions, validKey } = require('../services/storeCollectionDefinitions');

test('collection definitions reject prototype paths, markup, unbounded values and unknown fields', () => {
  const valid = { key: 'regalos-audio', title: 'Regalos de audio', theme: 'all', order: 3, enabled: true };
  assert.deepEqual(normalizeDefinition(valid), { ...valid, removed: false });
  for (const key of ['__proto__', 'constructor', 'prototype', 'setup.name', '$set', 'Setup', 'a'.repeat(41)]) {
    assert.equal(validKey(key), false);
    assert.equal(normalizeDefinition({ ...valid, key }), null);
  }
  for (const changes of [{ title: '<img>' }, { title: 'hola\ncontenido' }, { title: 'x'.repeat(81) },
    { theme: 'bad' }, { enabled: 'true' }, { order: 1.5 }, { order: 101 }, { products: [] }]) {
    assert.equal(normalizeDefinition({ ...valid, ...changes }), null);
  }
  assert.deepEqual(normalizeDefinition({ key: 'setup', remove: true }), { key: 'setup', remove: true });
  assert.equal(normalizeDefinition({ key: 'setup', remove: true, title: 'extra' }), null);
});

test('collection definitions retain defaults, rename by stable key, order and remove through tombstones', () => {
  assert.deepEqual(mergeDefinitions(), defaults);
  const definitions = mergeDefinitions([
    { _id: 'setup', title: 'Mi escritorio', theme: 'all', order: 10, enabled: false },
    { _id: 'study', removed: true },
    { _id: 'regalos-audio', title: 'Audio', theme: 'christmas', order: 0, enabled: true },
  ]);
  assert.equal(definitions.some(({ key }) => key === 'study'), false);
  assert.equal(definitions[0].key, 'regalos-audio');
  assert.equal(definitions.at(-1).key, 'setup');
  assert.equal(definitions.at(-1).title, 'Mi escritorio');
  assert.equal(definitions.at(-1).enabled, false);
});

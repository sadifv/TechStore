const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureCatalogIndexes } = require('../scripts/ensureCatalogIndexes');
test('index migration defaults to read-only and repeated apply preserves unrelated indexes', async () => {
  const indexes = new Map(); let writes = 0;
  const db = { collection(name) {
    if (!indexes.has(name)) indexes.set(name, [{ name: '_id_', key: { _id: 1 } }]);
    return { listIndexes: () => ({ toArray: async () => indexes.get(name) }), createIndex: async (key, { name: indexName }) => { writes++; indexes.get(name).push({ name: indexName, key, collation: { locale: 'simple' } }); } };
  } };
  assert.ok((await ensureCatalogIndexes(db)).every((entry) => entry.status === 'would-create'));
  assert.equal(writes, 0);
  await ensureCatalogIndexes(db, { apply: true }); assert.equal(writes, 3);
  assert.ok((await ensureCatalogIndexes(db, { apply: true })).every((entry) => entry.status === 'existing'));
  assert.equal(writes, 3); assert.ok(indexes.get('products').some((index) => index.name === '_id_'));
});

test('equivalent differently named indexes are reused and conflicts abort without writes', async () => {
 const { catalogIndexes } = require('../services/catalogIndexes'); let writes = 0;
 const db = { collection(collection) { return { listIndexes: () => ({ toArray: async () => catalogIndexes.filter(index => index.collection === collection).map(index => ({ key: index.key, name: 'other-' + index.name })) }), createIndex: async () => { writes++; } }; } };
 assert.ok((await ensureCatalogIndexes(db, { apply: true })).every(item => item.status === 'existing')); assert.equal(writes, 0);
 const conflict = { collection() { return { listIndexes: () => ({ toArray: async () => [{ name: 'active_recent', key: { other: 1 } }] }), createIndex: async () => { writes++; } }; } };
 await assert.rejects(ensureCatalogIndexes(conflict, { apply: true }), /otra definición/); assert.equal(writes, 0);
});

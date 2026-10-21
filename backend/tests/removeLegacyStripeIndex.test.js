const assert = require('node:assert/strict');
const test = require('node:test');
const { removeLegacyStripeIndex, LEGACY_INDEX } = require('../scripts/removeLegacyStripeIndex');

function fakeDb({ indexes = [], legacyFieldCount = 0 } = {}) {
  const events = [];
  return {
    events,
    collection(name) {
      assert.equal(name, 'orders');
      return {
        listIndexes: () => ({ toArray: async () => indexes }),
        countDocuments: async (query) => {
          events.push(['count', query]);
          return legacyFieldCount;
        },
        dropIndex: async (index) => events.push(['drop', index]),
      };
    },
  };
}

test('dry run reports the exact legacy index and never drops it', async () => {
  const db = fakeDb({ indexes: [{ name: LEGACY_INDEX }] });
  const result = await removeLegacyStripeIndex(db);
  assert.equal(result.status, 'would-drop');
  assert.deepEqual(db.events, [['count', { stripeExpiresAt: { $exists: true } }]]);
});

test('apply drops only the exact index when no documents use its legacy field', async () => {
  const db = fakeDb({ indexes: [{ name: LEGACY_INDEX }, { name: 'paymentStatus_1' }] });
  const result = await removeLegacyStripeIndex(db, { apply: true });
  assert.equal(result.status, 'dropped');
  assert.deepEqual(db.events.at(-1), ['drop', LEGACY_INDEX]);
});

test('migration is idempotent and refuses to drop while legacy data exists', async () => {
  const absent = fakeDb({ indexes: [{ name: '_id_' }] });
  assert.equal((await removeLegacyStripeIndex(absent, { apply: true })).status, 'absent');
  const used = fakeDb({ indexes: [{ name: LEGACY_INDEX }], legacyFieldCount: 1 });
  await assert.rejects(removeLegacyStripeIndex(used, { apply: true }), /stripeExpiresAt/);
  assert.equal(
    used.events.some(([event]) => event === 'drop'),
    false,
  );
});

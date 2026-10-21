const assert = require('node:assert/strict');
const test = require('node:test');
const { MongoRateLimitStore } = require('../middleware/mongoRateLimitStore');

test('stores rate-limit counters under a shared, expiring Mongo key', async () => {
  const calls = [];
  const now = new Date('2026-10-20T12:00:00.000Z');
  const resetTime = new Date(now.getTime() + 15 * 60 * 1000);
  const collection = {
    async createIndex(keys, options) {
      calls.push({ type: 'index', keys, options });
    },
    async findOneAndUpdate(filter, update, options) {
      calls.push({ type: 'increment', filter, update, options });
      return { _id: filter._id, totalHits: 3, expiresAt: resetTime };
    },
  };
  const store = new MongoRateLimitStore('password-recovery', {
    getCollection: () => collection,
    now: () => now,
  });
  store.init({ windowMs: 15 * 60 * 1000 });

  const result = await store.increment('192.0.2.8');

  assert.equal(result.totalHits, 3);
  assert.equal(result.resetTime, resetTime);
  assert.equal(calls[1].filter._id, 'password-recovery:192.0.2.8');
  assert.deepEqual(calls[1].options, { upsert: true, returnDocument: 'after' });
  assert.deepEqual(calls[0].options, { expireAfterSeconds: 0, name: 'rate_limit_expiry' });
});

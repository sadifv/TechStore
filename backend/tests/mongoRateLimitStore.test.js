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

function sharedCollection() {
  const counters = new Map();
  return {
    counters,
    async createIndex() { return 'rate_limit_expiry'; },
    async findOneAndUpdate({ _id }) {
      const now = new Date();
      const previous = counters.get(_id);
      const active = previous && previous.expiresAt > now;
      const counter = {
        totalHits: active ? previous.totalHits + 1 : 1,
        expiresAt: active ? previous.expiresAt : new Date(now.getTime() + windowMsFor(_id)),
      };
      counters.set(_id, counter);
      return { ...counter };
    },
    async updateOne() {},
    async deleteOne({ _id }) { counters.delete(_id); },
  };
}

const windows = new Map();
function windowMsFor(key) { return windows.get(key.split(':')[0]); }
function createStore(bucket, collection, windowMs) {
  windows.set(bucket, windowMs);
  const instance = new MongoRateLimitStore(bucket, { getCollection: () => collection });
  instance.init({ windowMs });
  return instance;
}

test('separate store instances share a bucket but independent operations do not', async () => {
  const collection = sharedCollection();
  const firstInstance = createStore('checkout', collection, 900_000);
  const secondInstance = createStore('checkout', collection, 900_000);
  const login = createStore('login', collection, 600_000);
  assert.equal((await firstInstance.increment('ip')).totalHits, 1);
  assert.equal((await secondInstance.increment('ip')).totalHits, 2);
  assert.equal((await login.increment('ip')).totalHits, 1);
});

test('store errors propagate so callers can fail closed', async () => {
  const broken = { createIndex: async () => { throw new Error('Mongo indisponible'); } };
  const limiter = createStore('checkout', broken, 900_000);
  await assert.rejects(limiter.increment('ip'), /Mongo indisponible/);
});

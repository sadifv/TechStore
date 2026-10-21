const mongoose = require('mongoose');

class MongoRateLimitStore {
  constructor(bucket, { getCollection, now = () => new Date() } = {}) {
    this.bucket = bucket;
    this.getCollection = getCollection || (() => mongoose.connection.db.collection('rate_limit_counters'));
    this.now = now;
    this.windowMs = 0;
    this.indexPromise = null;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const collection = this.getCollection();
    if (!this.indexPromise) {
      this.indexPromise = collection
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'rate_limit_expiry' })
        .catch((error) => {
          this.indexPromise = null;
          throw error;
        });
    }
    await this.indexPromise;

    const now = this.now();
    const activeWindow = { $gt: ['$expiresAt', now] };
    const result = await collection.findOneAndUpdate(
      { _id: `${this.bucket}:${key}` },
      [
        {
          $set: {
            totalHits: {
              $cond: [activeWindow, { $add: [{ $ifNull: ['$totalHits', 0] }, 1] }, 1],
            },
            expiresAt: {
              $cond: [activeWindow, '$expiresAt', new Date(now.getTime() + this.windowMs)],
            },
          },
        },
      ],
      { upsert: true, returnDocument: 'after' },
    );
    const counter = result?.value || result;
    if (!counter) throw new Error('MongoDB no devolvió el contador de solicitudes.');
    return { totalHits: counter.totalHits, resetTime: counter.expiresAt };
  }

  async decrement(key) {
    const collection = this.getCollection();
    return collection.updateOne(
      { _id: `${this.bucket}:${key}`, totalHits: { $gt: 0 } },
      { $inc: { totalHits: -1 } },
    );
  }

  async resetKey(key) {
    const collection = this.getCollection();
    return collection.deleteOne({ _id: `${this.bucket}:${key}` });
  }
}

module.exports = { MongoRateLimitStore };

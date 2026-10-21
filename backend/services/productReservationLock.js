const crypto = require('node:crypto');
const MaintenanceLock = require('../models/MaintenanceLock');
const { withInventoryTransaction } = require('./inventoryTransaction');
const LEASE_MS = 30000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const conflict = () => Object.assign(new Error('El stock se está actualizando. Inténtalo nuevamente.'), { statusCode: 409 });
async function acquireLock(productId) {
  const _id = `product-reservation:${productId}`;
  const ownerToken = crypto.randomUUID();
  const deadline = Date.now() + 2000;
  let acquired = false;
  do {
    const now = new Date();
    try {
      const lock = await MaintenanceLock.findOneAndUpdate(
        { _id, $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }] },
        { $set: { ownerToken, leaseUntil: new Date(now.getTime() + LEASE_MS) } },
        { upsert: true, returnDocument: 'after' });
      acquired = lock?.ownerToken === ownerToken;
    } catch (error) { if (error.code !== 11000) throw error; }
    if (!acquired) await delay(25);
  } while (!acquired && Date.now() < deadline);
  if (!acquired) throw conflict();
  let lost = false;
  let pending = Promise.resolve();
  let released = false;
  const assertOwned = async ({ session } = {}) => {
    if (lost || released) throw conflict();
    const result = await MaintenanceLock.updateOne(
      { _id, ownerToken, leaseUntil: { $gt: new Date() } },
      { $set: { leaseUntil: new Date(Date.now() + LEASE_MS) } },
      session ? { session } : {});
    if (result.matchedCount !== 1) { lost = true; throw conflict(); }
  };
  const timer = setInterval(() => {
    pending = pending.then(() => assertOwned()).catch(() => { lost = true; });
  }, 10000);
  timer.unref();
  return {
    assertOwned,
    async release() {
      if (released) return;
      clearInterval(timer); await pending; released = true;
      await MaintenanceLock.deleteOne({ _id, ownerToken });
    },
  };
}
async function acquireProductReservationLocks(productIds) {
  const leases = [];
  const release = async () => {
    const results = await Promise.allSettled([...leases].reverse().map((lease) => lease.release()));
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  };
  try {
    for (const id of [...new Set(productIds.map(String))].sort()) leases.push(await acquireLock(id));
  } catch (error) { await release(); throw error; }
  return { async assertOwned(options) { for (const lease of leases) await lease.assertOwned(options); }, release };
}
async function withProductReservationLock(productId, operation) {
  const lease = await acquireProductReservationLocks([productId]);
  try { await lease.assertOwned(); return await withInventoryTransaction((session) => operation(lease, session), { lease }); }
  finally { await lease.release(); }
}
module.exports = { acquireProductReservationLocks, withProductReservationLock };

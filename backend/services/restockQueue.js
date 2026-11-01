const crypto = require('node:crypto');
const Alert = require('../models/RestockAlert');
const Quota = require('../models/RestockQuota');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const { issueToken } = require('./restockTokens');
const { finishAlert, available, urlFor } = require('./restockAlerts');
const logger = require('../config/logger');
let timer;
async function processRestockAlerts(send = require('../config/mailer').sendRestockAvailableEmail) {
  await Alert.updateMany(
    { status: 'claimed', leaseUntil: { $lte: new Date() } },
    { $set: { status: 'waiting' }, $unset: { claim: 1, leaseUntil: 1 } },
  );
  const stale = await Alert.find({
    $or: [
      { status: 'sending', leaseUntil: { $lte: new Date() } },
      { status: { $in: ['pending_confirmation', 'waiting'] }, expiresAt: { $lte: new Date() } },
      { status: 'pending_confirmation', confirmExpiresAt: { $lte: new Date() } },
    ],
  })
    .limit(50)
    .lean();
  for (const row of stale)
    await finishAlert(
      row._id,
      row.generation,
      row.status === 'sending' ? 'delivery_unknown' : 'expired',
      { status: row.status, ...(row.status === 'sending' ? { claim: row.claim } : {}) },
    );
  const candidates = await Alert.find({ status: 'waiting', expiresAt: { $gt: new Date() } })
    .sort({ lastCheckedAt: 1, _id: 1 })
    .limit(50)
    .lean();
  if (candidates.length)
    await Alert.updateMany(
      { _id: { $in: candidates.map((r) => r._id) }, status: 'waiting' },
      { $set: { lastCheckedAt: new Date() } },
    );
  const products = await Product.find({
    _id: { $in: candidates.map((r) => r.product) },
    archivedAt: null,
  })
    .select('name stock archivedAt')
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const reserved = await Reservation.getReservedStockByProducts(products.map((p) => p._id));
  for (const row of candidates) {
    const product = byId.get(String(row.product));
    if (!product) {
      await finishAlert(row._id, row.generation, 'expired', { status: 'waiting' });
      continue;
    }
    if (product.stock - (reserved.get(String(product._id)) || 0) <= 0) continue;
    const claim = crypto.randomUUID();
    const unsubscribe = issueToken();
    const active = await Alert.findOneAndUpdate(
      {
        _id: row._id,
        generation: row.generation,
        status: 'waiting',
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { status: 'claimed', claim, leaseUntil: new Date(Date.now() + 300000) },
      },
      { returnDocument: 'after' },
    )
      .select('+email')
      .lean();
    if (!active) continue;
    const fresh = await Product.findOne({ _id: product._id, archivedAt: null })
      .select('name stock archivedAt')
      .lean();
    if (!fresh || !(await available(fresh))) {
      await Alert.updateOne(
        { _id: row._id, claim, status: 'claimed' },
        {
          $set: { status: 'waiting' },
          $unset: { claim: 1, leaseUntil: 1 },
        },
      );
      continue;
    }
    const message = {
      to: active.email,
      productName: fresh.name,
      productUrl: `${require('../config/frontendUrl').getFrontendBaseUrl()}/producto/${product._id}`,
      unsubscribeUrl: urlFor('baja', unsubscribe.token),
    };
    const started = await Alert.updateOne(
      {
        _id: row._id,
        generation: row.generation,
        claim,
        status: 'claimed',
        expiresAt: { $gt: new Date() },
      },
      { $set: { status: 'sending', leaseUntil: new Date(Date.now() + 300000) }, $addToSet: { unsubscribeHashes: unsubscribe.hash } },
    );
    if (started.modifiedCount !== 1) continue;
    let outcome = 'delivery_unknown';
    try {
      const result = await send(message);
      if (result?.success && result.messageId) outcome = 'sent';
    } catch {
      logger.warn('Aviso de disponibilidad con resultado de entrega desconocido.');
    }
    await finishAlert(row._id, row.generation, outcome, { status: 'sending', claim });
  }
  await Alert.deleteMany({
    status: { $in: ['sent', 'cancelled', 'expired', 'delivery_unknown'] },
    finishedAt: { $lt: new Date(Date.now() - 86400000) },
  });
  await Quota.deleteMany({
    active: { $size: 0 },
    updatedAt: { $lt: new Date(Date.now() - 3600000) },
  });
}
async function startRestockQueue() {
  if (timer) return;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processRestockAlerts();
    } catch (error) {
      logger.error('No se pudo revisar la cola de avisos.', {
        errorCode: error.code || error.name,
      });
    } finally {
      running = false;
    }
  };
  void run();
  timer = setInterval(run, 60000);
  timer.unref();
}
module.exports = { processRestockAlerts, startRestockQueue };

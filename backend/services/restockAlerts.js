const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Alert = require('../models/RestockAlert');
const Quota = require('../models/RestockQuota');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const { issueToken, tokenHash, emailKey } = require('./restockTokens');
const { getFrontendBaseUrl } = require('../config/frontendUrl');
const { isSingleEmail } = require('./emailAddress');
const DAY = 86400000;
const invalid = () =>
  Object.assign(new Error('El enlace no es válido o ya venció.'), { statusCode: 400 });
const activeStatuses = ['waiting', 'claimed', 'sending'];
const urlFor = (action, token) => {
  const origin = getFrontendBaseUrl();
  if (!origin) throw new Error('Frontend de correo no configurado.');
  return `${origin}/avisos/${action}#${token}`;
};
async function available(product) {
  if (!product || product.archivedAt) return false;
  return product.stock - (await Reservation.getReservedStock(product._id)) > 0;
}
async function ensureQuota(key) {
  try {
    await Quota.updateOne(
      { _id: key },
      { $setOnInsert: { active: [], confirmationRequests: [] } },
      { upsert: true },
    );
  } catch (e) {
    if (e.code !== 11000) throw e;
  }
}
function normalizeRequest({ productId, email, consent } = {}) {
  if (consent !== true)
    throw Object.assign(new Error('Debes dar tu consentimiento para recibir este aviso.'), {
      statusCode: 400,
    });
  if (
    typeof productId !== 'string' ||
    !/^[a-f0-9]{24}$/i.test(productId) ||
    typeof email !== 'string' ||
    email.length > 254 ||
    !isSingleEmail(email.trim())
  )
    throw Object.assign(new Error('Producto o correo inválido.'), { statusCode: 400 });
  return { productId: productId.toLowerCase(), email: email.trim().toLowerCase(), consent: true };
}
async function requestAlert(
  input,
  send = require('../config/mailer').sendRestockConfirmationEmail,
) {
  const { productId, email } = normalizeRequest(input);
  const product = await Product.findOne({ _id: productId, archivedAt: null }).lean();
  if (!product || (await available(product))) return;
  const key = emailKey(email);
  const requestKey = `${key}:${product._id}`;
  await ensureQuota(key);
  const confirmation = issueToken(),
    unsubscribe = issueToken();
  const now = new Date();
  let claimed = false;
  await mongoose.connection.transaction(async (session) => {
    claimed = false;
    const old = await Alert.findById(requestKey).session(session).lean();
    if (
      old &&
      (activeStatuses.includes(old.status) ||
        (old.status === 'pending_confirmation' &&
          old.lastRequestedAt > new Date(Date.now() - 900000)))
    )
      return;
    const quota = await Quota.findById(key).session(session);
    const recent = quota.confirmationRequests.filter((d) => d > new Date(Date.now() - 3600000));
    if (recent.length >= 10) return;
    quota.confirmationRequests = [...recent, now];
    await quota.save({ session });
    await Alert.updateOne(
      { _id: requestKey },
      {
        $set: {
          requestKey,
          product: product._id,
          email,
          emailKey: key,
          confirmHash: confirmation.hash,
          unsubscribeHashes: [unsubscribe.hash],
          status: 'pending_confirmation',
          confirmExpiresAt: new Date(Date.now() + DAY),
          expiresAt: new Date(Date.now() + 90 * DAY),
          consentedAt: now,
          lastRequestedAt: now,
          generation: crypto.randomUUID(),
        },
        $unset: { claim: 1, leaseUntil: 1, finishedAt: 1, confirmedAt: 1 },
      },
      { upsert: true, session },
    );
    claimed = true;
  });
  if (claimed)
    try {
      await send({
        to: email,
        productName: product.name,
        confirmUrl: urlFor('confirmar', confirmation.token),
        unsubscribeUrl: urlFor('baja', unsubscribe.token),
      });
    } catch {
      /* Public response remains generic; user may request again after the cooldown. */
    }
}
async function confirmAlert(token) {
  const hash = tokenHash(token);
  if (!hash) throw invalid();
  const initial = await Alert.findOne({ confirmHash: hash }).select('+emailKey').lean();
  if (!initial || !initial.emailKey || initial.confirmExpiresAt <= new Date()) throw invalid();
  await ensureQuota(initial.emailKey);
  await mongoose.connection.transaction(async (session) => {
    const alert = await Alert.findOne({ confirmHash: hash }).select('+emailKey').session(session);
    if (!alert || alert.confirmExpiresAt <= new Date()) throw invalid();
    if (alert.status === 'waiting') return;
    if (alert.status !== 'pending_confirmation') throw invalid();
    const quota = await Quota.findOneAndUpdate(
      {
        _id: alert.emailKey,
        $or: [{ active: alert._id }, { $expr: { $lt: [{ $size: '$active' }, 20] } }],
      },
      { $addToSet: { active: alert._id } },
      { session, returnDocument: 'after' },
    );
    if (!quota)
      throw Object.assign(
        new Error(
          'Has alcanzado el máximo de 20 avisos pendientes. Cancela alguno e inténtalo de nuevo.',
        ),
        { statusCode: 409 },
      );
    alert.status = 'waiting';
    alert.confirmedAt = new Date();
    await alert.save({ session });
  });
}
async function finishAlert(id, generation, status, extraFilter = {}) {
  return mongoose.connection.transaction(async (session) => {
    const row = await Alert.findOne({ _id: id, generation, ...extraFilter })
      .select('+emailKey')
      .session(session);
    if (!row) return false;
    if (row.emailKey)
      await Quota.updateOne({ _id: row.emailKey }, { $pull: { active: row._id } }, { session });
    await Alert.updateOne(
      { _id: id, generation, ...extraFilter },
      {
        $set: { status, finishedAt: new Date() },
        $unset: { email: 1, emailKey: 1, confirmHash: 1, claim: 1, leaseUntil: 1 },
      },
      { session },
    );
    return true;
  });
}
async function unsubscribeAlert(token) {
  const hash = tokenHash(token);
  if (!hash) throw invalid();
  const row = await Alert.findOne({ unsubscribeHashes: hash }).lean();
  if (!row) throw invalid();
  if (row.status === 'sending') return;
  await finishAlert(row._id, row.generation, 'cancelled', { status: { $ne: 'sending' } });
}
module.exports = {
  requestAlert,
  confirmAlert,
  unsubscribeAlert,
  finishAlert,
  available,
  urlFor,
  normalizeRequest,
};

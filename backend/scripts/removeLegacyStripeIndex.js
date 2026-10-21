const LEGACY_INDEX = 'paymentStatus_1_stripeExpiresAt_1';

async function removeLegacyStripeIndex(db, { apply = false } = {}) {
  const orders = db.collection('orders');
  const indexes = await orders.listIndexes().toArray();
  if (!indexes.some((index) => index.name === LEGACY_INDEX)) return { status: 'absent', index: LEGACY_INDEX };

  const legacyFieldCount = await orders.countDocuments({ stripeExpiresAt: { $exists: true } });
  if (legacyFieldCount > 0) {
    throw new Error(`Se encontraron ${legacyFieldCount} pedidos con stripeExpiresAt; no se elimina el índice.`);
  }
  if (!apply) return { status: 'would-drop', index: LEGACY_INDEX, legacyFieldCount };

  await orders.dropIndex(LEGACY_INDEX);
  return { status: 'dropped', index: LEGACY_INDEX, legacyFieldCount };
}

async function run() {
  require('dotenv').config();
  const mongoose = require('mongoose');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI no está configurado.');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  try {
    const result = await removeLegacyStripeIndex(mongoose.connection.db, { apply: process.argv.includes('--apply') });
    console.log(JSON.stringify(result));
    if (!process.argv.includes('--apply') && result.status === 'would-drop') {
      console.log('Vista previa únicamente. Añade --apply para eliminar este índice exacto.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { LEGACY_INDEX, removeLegacyStripeIndex };

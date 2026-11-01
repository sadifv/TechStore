const definitions = [
  { name: 'restock_confirm_hash', key: { confirmHash: 1 } },
  { name: 'restock_unsubscribe_hash', key: { unsubscribeHashes: 1 } },
  { name: 'restock_queue_scan', key: { status: 1, lastCheckedAt: 1, _id: 1 } },
  { name: 'restock_expiry', key: { status: 1, expiresAt: 1 } },
  { name: 'restock_confirmation_expiry', key: { status: 1, confirmExpiresAt: 1 } },
  { name: 'restock_delivery_lease', key: { status: 1, leaseUntil: 1 } },
  { name: 'restock_finished_cleanup', key: { status: 1, finishedAt: 1 } },
];
async function ensureRestockIndexes(db, { apply = false, databaseName } = {}) {
  if (apply && (!databaseName || databaseName !== db.databaseName))
    throw new Error('Confirma explícitamente la base de datos de destino.');
  const collection = db.collection('restockalerts');
  const existing = await collection
    .listIndexes()
    .toArray()
    .catch((e) => {
      if (e.code === 26) return [];
      throw e;
    });
  const actions = [];
  for (const definition of definitions) {
    const equivalent = existing.find(
      (i) =>
        JSON.stringify(i.key) === JSON.stringify(definition.key) &&
        !i.unique &&
        !i.sparse &&
        !i.partialFilterExpression &&
        !i.hidden &&
        (!i.collation || i.collation.locale === 'simple'),
    );
    if (equivalent) {
      actions.push({ name: definition.name, status: 'existing' });
      continue;
    }
    if (existing.some((i) => i.name === definition.name))
      throw new Error('Índice existente con definición incompatible; revisar manualmente.');
    if (apply) await collection.createIndex(definition.key, { name: definition.name });
    actions.push({ name: definition.name, status: apply ? 'created' : 'would-create' });
  }
  return actions;
}
if (require.main === module) {
  require('dotenv').config({ quiet: true });
  const mongoose = require('mongoose');
  (async () => {
    try {
      if (!process.env.MONGO_URI) throw new Error('Configura MONGO_URI.');
      await mongoose.connect(process.env.MONGO_URI, {
        autoIndex: false,
        serverSelectionTimeoutMS: 10000,
      });
      const databaseName = process.argv
        .find((a) => a.startsWith('--database='))
        ?.slice('--database='.length);
      console.log(
        JSON.stringify(
          await ensureRestockIndexes(mongoose.connection.db, {
            apply: process.argv.includes('--apply'),
            databaseName,
          }),
          null,
          2,
        ),
      );
    } finally {
      await mongoose.disconnect();
    }
  })().catch((e) => {
    console.error('No se pudieron revisar los índices de avisos.', e.code || e.name);
    process.exitCode = 1;
  });
}
module.exports = { ensureRestockIndexes };

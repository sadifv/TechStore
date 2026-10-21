const { catalogIndexes } = require('../services/catalogIndexes');
async function ensureCatalogIndexes(db, { apply = false } = {}) {
  const actions = [];
  for (const definition of catalogIndexes) {
    const { collection, name, key } = definition;
    const target = db.collection(collection);
    const indexes = await target
      .listIndexes()
      .toArray()
      .catch((error) => {
        if (error.code === 26 || error.codeName === 'NamespaceNotFound') return [];
        throw error;
      });
    const equivalent = indexes.find(
      (index) =>
        JSON.stringify(index.key) === JSON.stringify(key) &&
        !index.sparse &&
        !index.partialFilterExpression &&
        !index.hidden &&
        !index.unique &&
        (!index.collation || index.collation.locale === 'simple'),
    );
    if (equivalent) {
      actions.push({ ...definition, status: 'existing' });
      continue;
    }
    if (indexes.some((index) => index.name === name))
      throw new Error(`El índice ${name} ya existe con otra definición; revisar manualmente.`);
    if (apply) await target.createIndex(key, { name });
    actions.push({ ...definition, status: apply ? 'created' : 'would-create' });
  }
  return actions;
}
async function run() {
  require('dotenv').config();
  const mongoose = require('mongoose');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI no está configurado.');
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: false,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(
      JSON.stringify(
        await ensureCatalogIndexes(mongoose.connection.db, {
          apply: process.argv.includes('--apply'),
        }),
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
}
if (require.main === module)
  run().catch((error) => {
    console.error('No se pudieron verificar los índices:', error.code || error.name);
    process.exitCode = 1;
  });
module.exports = { ensureCatalogIndexes };

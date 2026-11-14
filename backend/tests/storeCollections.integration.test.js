const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const StoreCollection = require('../models/StoreCollection');
const Appearance = require('../models/StoreAppearance');
const Product = require('../models/Product');
const Audit = require('../models/AdminAuditEvent');
const controller = require('../controllers/storeCollectionsController');

async function invoke(handler, body = {}) {
  const res = { statusCode: 200, set() { return this; }, status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; } };
  await handler({ body, params: {}, user: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' } }, res, (error) => { throw error; });
  return res;
}

test('collections create, rename, disable, delete and audit atomically without deleting products',
  { skip: process.env.TECHSTORE_INTEGRATION !== '1' }, async (t) => {
    const replica = await startLocalReplicaSet();
    t.after(async () => { await mongoose.disconnect(); await replica.stop(); });
    await mongoose.connect(replica.uri);
    for (const Model of [StoreCollection, Appearance, Product, Audit]) await Model.createCollection();
    const product = await Product.create({ name: 'Prueba audio', price: 10, stock: 1, category: 'Audio', image: '/images/audio.jpg' });
    const definition = { key: 'regalos-audio', title: 'Regalos de audio', theme: 'all', order: 1, enabled: true };
    assert.equal((await invoke(controller.updateDefinition, definition)).statusCode, 200);
    assert.equal((await invoke(controller.updateSelection, { key: definition.key, ids: [String(product._id)] })).statusCode, 200);
    let publicResult = await invoke(controller.getCollections);
    assert.equal(publicResult.body.collections[definition.key][0].name, product.name);
    await invoke(controller.updateDefinition, { ...definition, title: 'Nuevo nombre', enabled: false });
    publicResult = await invoke(controller.getCollections);
    assert.equal(publicResult.body.collections[definition.key], undefined);
    assert.equal((await invoke(controller.getSelection)).body.definitions.find(({ key }) => key === definition.key).title, 'Nuevo nombre');
    await invoke(controller.updateDefinition, { key: definition.key, remove: true });
    assert.equal((await invoke(controller.getSelection)).body.definitions.some(({ key }) => key === definition.key), false);
    assert.equal(await Product.countDocuments(), 1);
    assert.equal(await Audit.countDocuments({ action: 'collection.updated' }), 4);
    const original = Audit.create;
    Audit.create = async () => { throw new Error('fixture audit failure'); };
    try { await assert.rejects(invoke(controller.updateDefinition, { ...definition, title: 'Debe revertirse' }), /fixture audit failure/); }
    finally { Audit.create = original; }
    assert.equal((await StoreCollection.findById(definition.key).lean()).removed, true);
  });

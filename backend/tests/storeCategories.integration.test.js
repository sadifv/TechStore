const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const StoreCategories = require('../models/StoreCategories');
const Product = require('../models/Product');
const Audit = require('../models/AdminAuditEvent');
const { defaultCategories } = require('../services/storeCategories');
const controller = require('../controllers/storeCategoriesController');

async function update(body) {
  const res = {
    statusCode: 200,
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
    set() { return this; },
  };
  await controller.updateCategories({ body, user: { id: new mongoose.Types.ObjectId().toString() }, params: {} }, res, error => { throw error; });
  return res;
}
test('category rename is atomic with audit, preserves archived products and rejects stale edits',
  { skip: process.env.TECHSTORE_INTEGRATION !== '1' }, async (t) => {
    const replica = await startLocalReplicaSet();
    t.after(async () => { await mongoose.disconnect(); await replica.stop(); });
    await mongoose.connect(replica.uri);
    await Promise.all([StoreCategories.init(), Product.init(), Audit.createCollection()]);
    const laptop = await Product.create({ name: 'Fixture laptop', price: 100, category: 'Laptops', stock: 2 });
    const archived = await Product.create({ name: 'Fixture archived', price: 20, category: 'Laptops', archivedAt: new Date(), stock: 0 });
    const body = { revision: 0, categories: defaultCategories.map(({ id, name, image, order }) => ({ id, name, image, order })) };
    body.categories[0].name = 'Portátiles';
    assert.equal((await update(body)).statusCode, 200);
    assert.equal((await Product.findById(laptop._id)).category, 'Portátiles');
    assert.equal((await Product.findById(archived._id)).category, 'Portátiles');
    assert.equal(await Audit.countDocuments({ action: 'category.updated' }), 1);
    assert.equal((await update(body)).statusCode, 409);
    const remove = { revision: 1, categories: body.categories.slice(1).map((entry, order) => ({ ...entry, order })) };
    assert.equal((await update(remove)).statusCode, 409);
    assert.equal((await StoreCategories.findById('global')).categories[0].name, 'Portátiles');
    assert.equal(await Audit.countDocuments({ action: 'category.updated' }), 1);
    const createAudit = Audit.create;
    Audit.create = async () => { throw new Error('Audit fixture unavailable'); };
    try {
      const failure = structuredClone(body);
      failure.revision = 1;
      failure.categories[0].name = 'Ordenadores';
      await assert.rejects(update(failure), /Audit fixture unavailable/);
      assert.equal((await Product.findById(laptop._id)).category, 'Portátiles');
      assert.equal((await StoreCategories.findById('global')).revision, 1);
    } finally { Audit.create = createAudit; }
  });

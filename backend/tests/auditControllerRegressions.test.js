const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
function loadController(file, mocks) {
  const target = path.resolve(__dirname, '../controllers', file);
  const original = Module._load;
  Module._load = function(request, parent, main) {
    if (parent?.filename === target && Object.hasOwn(mocks, request)) return mocks[request];
    return original.call(this, request, parent, main);
  };
  try { delete require.cache[target]; return require(target); }
  finally { Module._load = original; }
}
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
test('successful product archive returns success for the archived after-document', async () => {
  const { deleteProduct } = loadController('productController.js', {
    '../models/Product': { findOneAndUpdate: async (filter, update) => { assert.equal(filter.archivedAt, null); return { _id: 'product', archivedAt: update.$set.archivedAt }; } },
    '../models/Reservation': {}, '../config/logger': {},
  });
  const res = response();
  await deleteProduct({ params: { id: 'product' } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 200); assert.equal(res.body.success, true);
});
test('TechBot prompt quotes effective price when a flash sale has expired', async () => {
  let prompt;
  const { processAiChat } = loadController('aiController.js', {
    '../config/ai': { chat: { completions: { create: async (request) => { prompt = request.messages[0].content; return { choices: [{ message: { content: 'Respuesta' } }] }; } } } },
    '../config/logger': { error() {}, warn() {}, info() {} },
    '../models/Product': { find: () => ({ sort() { return this; }, limit() { return this; }, lean: async () => [{ name: 'Expired', category: 'Test', stock: 1, price: 5, originalPrice: 10, flashSale: true, flashSaleEndsAt: new Date(0) }] }) },
  });
  await processAiChat({ body: { message: 'Precio' }, session: {} }, response());
  assert.match(prompt, /Expired \(Test\): \$10/);
});

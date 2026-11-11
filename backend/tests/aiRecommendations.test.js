const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const controllerPath = path.join(__dirname, '../controllers/aiController.js');
const originalLoad = Module._load;
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
let currentProducts = [{ _id: id, name: 'Monitor de prueba', price: 150, availableStock: 2 }];
let receivedIds;
let providerMessages;
const mocks = {
  '../config/ai': {
    chat: {
      completions: {
        create: async ({ messages }) => {
          providerMessages = messages;
          return { choices: [{ message: { content: 'Puedes ver el Monitor de prueba.' } }] };
        },
      },
    },
  },
  '../config/logger': { info() {}, warn() {}, error() {} },
  '../models/Product': {
    find: () => ({
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      lean: async () => [
        { _id: id, name: 'Monitor de prueba', category: 'Monitores', price: 150, stock: 2 },
      ],
    }),
  },
  '../services/aiProducts': {
    findMentionedProductIds: () => [id],
    resolveAiProducts: async (ids) => {
      receivedIds = ids;
      return currentProducts;
    },
  },
};
let controller;
try {
  Module._load = function (request, parent, ...args) {
    if (parent?.filename === controllerPath && mocks[request]) return mocks[request];
    return originalLoad.call(this, request, parent, ...args);
  };
  controller = require(controllerPath);
} finally {
  Module._load = originalLoad;
}
const response = () => ({
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(value) {
    this.body = value;
  },
});

test('chat returns catalog cards and persists only their IDs in bounded session history', async () => {
  const session = {
    chatHistory: [{ role: 'assistant', content: 'Respuesta anterior', productIds: [id] }],
  };
  const res = response();
  await controller.processAiChat({ body: { message: 'Busco un monitor' }, session }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.products, currentProducts);
  assert.deepEqual(receivedIds, [id]);
  assert.deepEqual(session.chatHistory.at(-1).productIds, [id]);
  assert.equal(session.chatHistory.at(-1).products, undefined);
  assert.deepEqual(providerMessages[1], { role: 'assistant', content: 'Respuesta anterior' });
});

test('history refreshes recommendation data and tolerates old messages without IDs', async () => {
  const req = {
    session: {
      chatHistory: [
        { role: 'user', content: 'Consulta anterior' },
        { role: 'assistant', content: 'Monitor de prueba', productIds: [id] },
      ],
    },
  };
  currentProducts = [{ _id: id, name: 'Monitor de prueba', price: 175, availableStock: 1 }];
  const res = response();
  await controller.getChatHistory(req, res);
  assert.equal(res.body.history[1].products[0].price, 175);
  assert.deepEqual(res.body.history[0].products, []);
  currentProducts = [];
  await controller.getChatHistory(req, res);
  assert.deepEqual(res.body.history[1].products, []);
  assert.equal(res.body.history[1].content, 'Monitor de prueba');
});

const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const controllerPath = path.join(__dirname, '..', 'controllers', 'aiController.js');
const originalLoad = Module._load;
let providerCalls = 0;
let providerMessages;
let productQueries = 0;
const Product = {
  find() {
    productQueries += 1;
    return { sort() { return this; }, limit() { return this; }, async lean() { return []; } };
  },
};
const mocks = new Map([
  [
    '../config/ai',
    {
      chat: {
        completions: {
          create: async ({ messages }) => {
            providerCalls += 1;
            providerMessages = messages;
            return { choices: [{ message: { content: 'respuesta válida' } }] };
          },
        },
      },
    },
  ],
  ['../config/logger', { warn() {}, info() {}, error() {} }],
  ['../models/Product', Product],
]);
Module._load = function (request, parent, isMain) {
  if (parent?.filename === controllerPath && mocks.has(request)) return mocks.get(request);
  return originalLoad.call(this, request, parent, isMain);
};
let processAiChat;
try {
  ({ processAiChat } = require(controllerPath));
} finally {
  Module._load = originalLoad;
}

const call = async (message, session = {}) => {
  let statusCode;
  let body;
  await processAiChat(
    { body: { message }, session },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        body = value;
      },
    },
  );
  return { statusCode, body };
};

test('rejects non-string AI messages before querying products or provider', async () => {
  providerCalls = 0;
  productQueries = 0;
  const result = await call({ prompt: 'too long' });
  assert.equal(result.statusCode, 400);
  assert.equal(providerCalls, 0);
  assert.equal(productQueries, 0);
});

test('rejects AI messages longer than 500 characters on the server', async () => {
  providerCalls = 0;
  productQueries = 0;
  const result = await call('a'.repeat(501));
  assert.equal(result.statusCode, 400);
  assert.equal(providerCalls, 0);
  assert.equal(productQueries, 0);
});

test('rejects whitespace-only AI messages on the server', async () => {
  providerCalls = 0;
  productQueries = 0;
  const result = await call('   ');
  assert.equal(result.statusCode, 400);
  assert.equal(providerCalls, 0);
  assert.equal(productQueries, 0);
});

test('returns a client error when the request has no parsed body', async () => {
  let statusCode;
  await processAiChat(
    { session: {} },
    { status(code) { statusCode = code; return this; }, json() {} },
  );
  assert.equal(statusCode, 400);
});

test('filters legacy session history to valid roles and bounded message sizes', async () => {
  const result = await call('Hola', {
    chatHistory: [
      { role: 'system', content: 'Un mensaje de sistema no persistido por el servidor.' },
      { role: 'user', content: 'x'.repeat(501) },
      { role: 'user', content: 'consulta previa' },
    ],
  });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(providerMessages.slice(1), [
    { role: 'user', content: 'consulta previa' },
    { role: 'user', content: 'Hola' },
  ]);
});

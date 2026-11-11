const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const target = path.resolve(__dirname, '../controllers/newsletterController.js');
const original = Module._load;
let existing = null;
let createError;
let creates = 0;
let saves = 0;
let controller;
try {
  Module._load = function (request, parent, ...args) {
    if (parent?.filename === target && request === '../models/Newsletter')
      return {
        findOne: async () => existing,
        create: async () => {
          creates += 1;
          if (createError) throw createError;
        },
      };
    if (parent?.filename === target && request === '../config/logger') return { info() {} };
    return original.call(this, request, parent, ...args);
  };
  controller = require(target);
} finally {
  Module._load = original;
}

async function subscribe(body = { email: 'test@example.invalid', consent: true }) {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await controller.subscribeNewsletter({ body }, res, (error) => {
    throw error;
  });
  return { status: res.statusCode, body: res.body };
}

test('newsletter responses do not reveal new, active, inactive or concurrently inserted addresses', async () => {
  const first = await subscribe();
  existing = {
    isSubscribed: true,
    unsubscribeToken: 'keep',
    save: async () => {
      saves += 1;
    },
  };
  assert.deepEqual(await subscribe(), first);
  assert.equal(creates, 1);
  assert.equal(saves, 0);
  assert.equal(existing.unsubscribeToken, 'keep');
  existing.isSubscribed = false;
  assert.deepEqual(await subscribe(), first);
  assert.equal(saves, 1);
  assert.equal(existing.isSubscribed, true);
  existing = null;
  createError = Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { email: 1 } });
  assert.deepEqual(await subscribe(), first);
  createError = new Error('storage unavailable');
  await assert.rejects(() => subscribe(), /storage unavailable/);
  createError = undefined;
  assert.equal((await subscribe({ email: 'invalid', consent: true })).status, 400);
  assert.equal((await subscribe({ email: 'test@example.invalid', consent: false })).status, 400);
});

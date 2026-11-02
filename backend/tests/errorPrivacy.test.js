const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Module = require('node:module');
const path = require('node:path');
const messages = [];
const target = path.resolve(__dirname, '../middleware/errorMiddleware.js');
const original = Module._load;
Module._load = function (name, parent, ...args) {
  if (parent?.filename === target && name === '../config/logger')
    return {
      warn: (...values) => messages.push(values),
      error: (...values) => messages.push(values),
    };
  return original.call(this, name, parent, ...args);
};
let errorHandler;
try {
  errorHandler = require(target);
} finally {
  Module._load = original;
}

test('invalid JSON never echoes or logs fragments of submitted credentials', async (t) => {
  const app = express();
  app.use(express.json());
  app.post('/api/auth/login', (req, res) => res.json({ success: true }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"password":SECRET12345}',
  });
  assert.equal(res.status, 400);
  assert.equal((await res.text()).includes('SECRET'), false);
  assert.equal(JSON.stringify(messages).includes('SECRET'), false);
});

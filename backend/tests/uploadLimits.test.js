const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { uploadSingleProductImage } = require('../middleware/uploadMiddleware');

test('multipart product uploads reject oversized text and excessive fields before storage', async (t) => {
  const app = express();
  app.post('/upload', uploadSingleProductImage, (req, res) => res.json({ success: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/upload`;
  const large = new FormData();
  large.append('description', 'x'.repeat(70 * 1024));
  assert.equal((await fetch(url, { method: 'POST', body: large })).status, 400);
  const many = new FormData();
  for (let i = 0; i < 21; i++) many.append('field' + i, 'x');
  assert.equal((await fetch(url, { method: 'POST', body: many })).status, 400);
  const valid = new FormData();
  valid.append('name', 'Producto');
  valid.append('description', 'Descripción');
  assert.equal((await fetch(url, { method: 'POST', body: valid })).status, 200);
});

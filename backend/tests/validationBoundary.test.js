const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { validate } = require('../middleware/validate');

test('route spelling and structured fields cannot bypass public input validation', async (t) => {
  const app = express();
  app.use(express.json());
  app.post('/api/contact', validate, (req, res) => res.json({ success: true }));
  app.post('/api/admin/products', validate, (req, res) => res.json({ success: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const post = async (path, body) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await res.text();
    return res.status;
  };
  const contact = {
    name: 'Tester',
    email: 'test@example.invalid',
    message: 'A valid test message.',
  };
  assert.equal(await post('/api/contact', contact), 200);
  assert.equal(await post('/API/CONTACT/', { ...contact, message: 'x'.repeat(1001) }), 400);
  assert.equal(await post('/api/contact', { ...contact, email: [contact.email] }), 400);
  assert.equal(await post('/api/contact', { ...contact, name: { $ne: null } }), 400);
  const product = { name: 'Test product', price: '10', stock: '1', category: 'General' };
  assert.equal(await post('/api/admin/products', product), 200);
  for (const price of ['Infinity', ['10'], { $gt: 0 }])
    assert.equal(await post('/api/admin/products', { ...product, price }), 400);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { preventPrivateCaching, privateResponsePaths } = require('../middleware/privateResponses');

test('private API responses cannot be cached, including anonymous errors and conditional GETs', async (t) => {
  const app = express();
  app.use(privateResponsePaths, preventPrivateCaching);
  app.use((req, res) =>
    res.status(req.path.endsWith('/denied') ? 401 : 200).json({ value: 'test-only' }),
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of [
    '/api/auth/me',
    '/api/auth/account/name',
    '/api/auth/account/password',
    '/api/auth/account/email',
    '/api/auth/account/email/confirm',
    '/API/AUTH/me',
    '/api/auth/admin/mfa/enroll',
    '/api/admin/users',
    '/admin/orders',
    '/api/cart',
    '/api/orders',
    '/api/addresses',
    '/api/favorites',
    '/api/reviews/mine',
    '/api/ai/history',
    '/api/presence/heartbeat',
    '/api/auth/denied',
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.headers.get('cache-control'), 'no-store', path);
    const repeated = await fetch(base + path, {
      headers: { 'If-None-Match': response.headers.get('etag') || '' },
    });
    assert.equal(repeated.headers.get('cache-control'), 'no-store', path);
    await response.text();
    await repeated.text();
  }
  const publicResponse = await fetch(base + '/api/products');
  assert.equal(publicResponse.headers.get('cache-control'), null);
  await publicResponse.text();
});

const assert = require('node:assert/strict');
const { test } = require('node:test');
const isApiRequest = require('../middleware/isApiRequest');

test('detects an API path behind an Express mount prefix', () => {
  assert.equal(
    isApiRequest({
      originalUrl: '/membership',
      baseUrl: '/api',
      path: '/membership',
      headers: { accept: '*/*' },
    }),
    true,
  );
});

test('detects a fetch-style request from a non-HTML Accept header', () => {
  assert.equal(
    isApiRequest({
      originalUrl: '/admin/orders/123/status',
      baseUrl: '/admin',
      path: '/orders/123/status',
      headers: { accept: '*/*' },
    }),
    true,
  );
});

test('keeps ordinary browser navigation classified as HTML', () => {
  assert.equal(
    isApiRequest({
      originalUrl: '/admin/dashboard',
      baseUrl: '/admin',
      path: '/dashboard',
      headers: { accept: 'text/html,application/xhtml+xml' },
    }),
    false,
  );
});

test('detects JSON request and response headers', () => {
  assert.equal(
    isApiRequest({
      originalUrl: '/admin/products',
      baseUrl: '/admin',
      path: '/products',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
    }),
    true,
  );
});

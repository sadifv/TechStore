const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createCsrfProtection } = require('../middleware/csrfProtection');

const makeRequest = (method, headers = {}) => ({
  method,
  get(name) {
    return headers[name.toLowerCase()];
  },
});

const runGuard = (req) => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;
  createCsrfProtection(['https://shop.example'])(req, response, () => {
    nextCalled = true;
  });
  return { response, nextCalled };
};

test('rejects state-changing requests from a cross-site browser context', () => {
  const { response, nextCalled } = runGuard(
    makeRequest('POST', { 'sec-fetch-site': 'cross-site' }),
  );

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('rejects an unlisted origin and accepts the configured shop origin', () => {
  assert.equal(
    runGuard(makeRequest('DELETE', { origin: 'https://evil.example' })).response.statusCode,
    403,
  );
  assert.equal(
    runGuard(makeRequest('PATCH', { origin: 'https://shop.example' })).nextCalled,
    true,
  );
});

test('leaves safe methods and originless non-browser requests unaffected', () => {
  assert.equal(runGuard(makeRequest('GET', { 'sec-fetch-site': 'cross-site' })).nextCalled, true);
  assert.equal(runGuard(makeRequest('POST')).nextCalled, true);
});

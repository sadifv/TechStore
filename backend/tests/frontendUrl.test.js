const test = require('node:test');
const assert = require('node:assert/strict');
const { getFrontendBaseUrl } = require('../config/frontendUrl');

test('frontend destinations validate trusted configuration and require HTTPS in production', () => {
  const names = ['FRONTEND_URL', 'APP_URL', 'NODE_ENV'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_URL;
    delete process.env.APP_URL;
    assert.equal(getFrontendBaseUrl(), null);
    process.env.APP_URL = 'https://store.example.test/';
    assert.equal(getFrontendBaseUrl(), 'https://store.example.test');
    for (const value of [
      'http://store.example.test',
      'javascript:alert(1)',
      '//attacker.example.test',
      'https://user:password@store.example.test',
      'https://store.example.test/#fragment',
      'https://store.example.test/?redirect=elsewhere',
      'invalid',
    ]) {
      process.env.FRONTEND_URL = value;
      assert.equal(getFrontendBaseUrl(), null, value);
    }
    process.env.FRONTEND_URL = 'https://shop.example.test/store/';
    assert.equal(getFrontendBaseUrl(), 'https://shop.example.test/store');
    delete process.env.FRONTEND_URL;
    process.env.NODE_ENV = 'development';
    assert.equal(getFrontendBaseUrl(), 'http://localhost:5173');
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

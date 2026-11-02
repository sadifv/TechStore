const test = require('node:test');
const assert = require('node:assert/strict');
const { isSingleEmail } = require('../services/emailAddress');
const User = require('../models/User');
const Newsletter = require('../models/Newsletter');
const { validate } = require('../middleware/validate');

test('account, newsletter and public validation require exactly one bounded mailbox', async () => {
  for (const email of [
    'one@example.invalid,two@example.invalid',
    'one@example.invalid;two@example.invalid',
    'one@example.invalid;local',
    'Name <one@example.invalid>',
    'one@example.invalid\r\nBcc: two@example.invalid',
    'x'.repeat(65) + '@example.invalid',
  ]) {
    assert.equal(isSingleEmail(email), false);
    await assert.rejects(
      new User({ name: 'Test', email, password: 'test-only-password' }).validate(),
    );
    await assert.rejects(new Newsletter({ email }).validate());
    for (const url of [
      '/api/auth/register',
      '/api/auth/login',
      '/api/auth/forgot-password',
      '/api/newsletter',
      '/api/contact',
    ]) {
      const response = {
        status(code) {
          this.code = code;
          return this;
        },
        json() {},
      };
      validate(
        {
          originalUrl: url,
          path: url,
          method: 'POST',
          body: {
            name: 'Test',
            email,
            password: 'test-only-password',
            message: 'A test-only contact message.',
          },
        },
        response,
        () => assert.fail(`invalid mailbox accepted at ${url}`),
      );
      assert.equal(response.code, 400);
    }
  }
  for (const email of [
    'one+tag@example.invalid',
    'first.last@sub.example.invalid',
    "o'hara@example.invalid",
  ])
    assert.equal(isSingleEmail(email), true);
});

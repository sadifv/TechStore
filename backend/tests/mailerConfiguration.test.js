const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const mailerPath = path.join(__dirname, '..', 'config', 'mailer.js');
const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
};
const loadMailer = (mode) => {
  process.env.NODE_ENV = mode;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete require.cache[mailerPath];
  return require(mailerPath);
};

test('refuses to simulate transactional email in production when SMTP is missing', async () => {
  try {
    const mailer = loadMailer('production');
    await assert.rejects(
      mailer.sendPasswordResetEmail('user@example.test', 'https://example.test/reset'),
      {
        code: 'SMTP_NOT_CONFIGURED',
        statusCode: 503,
      },
    );
  } finally {
    delete require.cache[mailerPath];
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('keeps the explicit simulated-email behavior in development', async () => {
  const previous = { ...originalEnvironment };
  try {
    const mailer = loadMailer('development');
    const result = await mailer.sendPasswordResetEmail(
      'user@example.test',
      'http://localhost/reset',
    );
    assert.equal(result.simulated, true);
  } finally {
    delete require.cache[mailerPath];
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

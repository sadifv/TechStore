const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const mailerPath = path.join(__dirname, '..', 'config', 'mailer.js');
const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_TRANSPORT: process.env.EMAIL_TRANSPORT,
  GMAIL_USER: process.env.GMAIL_USER,
  GMAIL_OAUTH_CLIENT_ID: process.env.GMAIL_OAUTH_CLIENT_ID,
  GMAIL_OAUTH_CLIENT_SECRET: process.env.GMAIL_OAUTH_CLIENT_SECRET,
  GMAIL_OAUTH_REFRESH_TOKEN: process.env.GMAIL_OAUTH_REFRESH_TOKEN,
};
const loadMailer = (mode) => {
  process.env.NODE_ENV = mode;
  process.env.EMAIL_TRANSPORT = 'smtp';
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

test('explicit Gmail API refuses incomplete configuration even with SMTP credentials present', async () => {
  try {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_TRANSPORT = 'gmail-api';
    process.env.SMTP_USER = 'fake@example.invalid';
    process.env.SMTP_PASS = 'fake-test-only';
    delete process.env.GMAIL_OAUTH_REFRESH_TOKEN;
    delete require.cache[mailerPath];
    const mailer = require(mailerPath);
    await assert.rejects(mailer.sendWelcomeEmail('recipient@example.invalid', 'Test'), {
      code: 'GMAIL_API_NOT_CONFIGURED',
      statusCode: 503,
    });
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

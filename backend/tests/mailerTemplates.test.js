const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const mailerPath = path.join(__dirname, '../config/mailer.js');
const messages = [];
const originalLoad = Module._load;
const previous = Object.fromEntries(
  ['SMTP_USER', 'SMTP_PASS', 'APP_URL', 'EMAIL_TRANSPORT'].map((key) => [key, process.env[key]]),
);
let mailer;
try {
  process.env.SMTP_USER = 'test@example.invalid';
  process.env.SMTP_PASS = 'fake-test-only';
  process.env.APP_URL = 'https://store.example.invalid';
  process.env.EMAIL_TRANSPORT = 'smtp';
  Module._load = function (name, parent, ...args) {
    if (parent?.filename === mailerPath && name === 'nodemailer')
      return {
        createTransport: () => ({
          verify: (cb) => cb(null, true),
          sendMail: async (message) => {
            messages.push(message);
            return { messageId: 'test-only' };
          },
        }),
      };
    if (parent?.filename === mailerPath && name === './logger')
      return { info() {}, warn() {}, error() {} };
    return originalLoad.call(this, name, parent, ...args);
  };
  mailer = require(mailerPath);
} finally {
  Module._load = originalLoad;
}

test.after(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('welcome renders the real template with escaped user data and a catalog link', async () => {
  await mailer.sendWelcomeEmail('recipient@example.invalid', '<Example>');
  const message = messages.at(-1);
  assert.ok(message.html.includes('&lt;Example&gt;'));
  assert.ok(message.html.includes('https://store.example.invalid/catalogo'));
});

test('password recovery renders the real template with the supplied reset URL', async () => {
  const url = 'https://store.example.invalid/reset-password/test-only';
  await mailer.sendPasswordResetEmail('recipient@example.invalid', url);
  assert.ok(messages.at(-1).html.includes(url));
});

test('campaign renders its subject and content, preserves unsubscribe and escapes HTML', async () => {
  await mailer.sendMarketingCampaignEmail({
    to: 'recipient@example.invalid',
    subject: '<Campaign>',
    name: '<Example>',
    content: '<script>test-only</script>',
    couponCode: 'TEST',
    unsubscribeUrl: 'https://store.example.invalid/marketing/unsubscribe?token=test-only',
  });
  const message = messages.at(-1);
  assert.equal(message.subject, '<Campaign>');
  assert.ok(message.html.includes('&lt;Campaign&gt;'));
  assert.ok(message.html.includes('&lt;Example&gt;'));
  assert.ok(!message.html.includes('<script>test-only</script>'));
  assert.ok(message.html.includes('/marketing/unsubscribe?token=test-only'));
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGmailApiTransport } = require('../services/gmailApiTransport');
const { OAuth2Client } = require('google-auth-library');

const credentials = {
  user: 'sender@example.invalid',
  clientId: 'test-client',
  clientSecret: 'test-secret',
  refreshToken: 'test-refresh',
};
function setup(result) {
  let client;
  class FakeAuth {
    constructor(options) {
      this.options = options;
      client = this;
    }
    setCredentials(value) {
      this.credentials = value;
    }
    async request(options) {
      this.requestOptions = options;
      if (result instanceof Error) throw result;
      return result;
    }
  }
  const transport = createGmailApiTransport(credentials, FakeAuth);
  return { transport, client };
}
const message = {
  to: 'recipient@example.invalid',
  subject: 'Test subject',
  html: '<p>Test message</p>',
};

test('Gmail API builds real MIME and sends base64url over HTTPS with OAuth and bounded requests', async () => {
  const { transport, client } = setup({ data: { id: 'acknowledged-message' } });
  const result = await transport.sendMail(message);
  assert.equal(result.messageId, 'acknowledged-message');
  assert.equal(client.credentials.refresh_token, credentials.refreshToken);
  assert.equal(client.options.clientId, credentials.clientId);
  assert.equal(client.options.transporterOptions.timeout, 15000);
  const request = client.requestOptions;
  assert.equal(request.url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(request.method, 'POST');
  assert.equal(request.retry, false);
  assert.equal(request.timeout, 15000);
  assert.match(request.data.raw, /^[A-Za-z0-9_-]+$/);
  const mime = Buffer.from(request.data.raw, 'base64url').toString();
  assert.ok(mime.includes('From: TechStore <sender@example.invalid>'));
  assert.ok(mime.includes('To: recipient@example.invalid'));
  assert.ok(mime.includes('Subject: Test subject'));
  assert.ok(mime.includes('Content-Type: text/html; charset=utf-8'));
  assert.ok(mime.includes('<p>Test message</p>'));
});

test('Gmail API sanitizes provider errors and never returns success without acknowledgement', async () => {
  for (const result of [new Error('secret-token and raw-message'), { data: {} }]) {
    const { transport } = setup(result);
    await assert.rejects(transport.sendMail(message), (error) => {
      assert.equal(error.code, 'GMAIL_API_SEND_FAILED');
      assert.equal(error.statusCode, 502);
      assert.ok(!String(error).includes('secret-token'));
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test('real OAuth client refreshes access and does not repeat an ambiguous send failure', async () => {
  for (const failSend of [false, true]) {
    const calls = [];
    class IsolatedAuthClient extends OAuth2Client {
      constructor(options) {
        super({
          ...options,
          transporterOptions: {
            ...options.transporterOptions,
            adapter: async (request) => {
              const url = String(request.url);
              calls.push(url);
              let data;
              if (url === 'https://oauth2.googleapis.com/token') {
                data = { access_token: 'test-access-only', expires_in: 3600, token_type: 'Bearer' };
              } else {
                assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
                assert.equal(
                  new Headers(request.headers).get('authorization'),
                  'Bearer test-access-only',
                );
                if (failSend)
                  throw Object.assign(new Error('test network failure'), { code: 'ETIMEDOUT' });
                data = { id: 'accepted-test-message' };
              }
              return {
                data,
                status: 200,
                statusText: 'OK',
                headers: new Headers(),
                config: request,
              };
            },
          },
        });
      }
    }
    const transport = createGmailApiTransport(credentials, IsolatedAuthClient);
    if (failSend)
      await assert.rejects(transport.sendMail(message), { code: 'GMAIL_API_SEND_FAILED' });
    else assert.equal((await transport.sendMail(message)).messageId, 'accepted-test-message');
    assert.deepEqual(calls, [
      'https://oauth2.googleapis.com/token',
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    ]);
  }
});

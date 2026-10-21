const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const controllerPath = path.join(__dirname, '..', 'controllers', 'authController.js');
const originalLoad = Module._load;
let resolveUserLookup;
const userLookup = new Promise((resolve) => {
  resolveUserLookup = resolve;
});
let lookupUser = () => userLookup;
const sentResetEmails = [];
const savedUsers = [];
const User = {
  findOne() {
    return { select: () => lookupUser() };
  },
};
const dependencies = new Map([
  ['../models/User', User],
  [
    '../config/mailer',
    {
      async sendPasswordResetEmail(email, url) {
        sentResetEmails.push({ email, url });
        return { success: true };
      },
    },
  ],
  ['../config/logger', { warn() {}, info() {} }],
  ['../config/frontendUrl', { getFrontendBaseUrl: () => 'https://shop.example.test' }],
]);

Module._load = function (request, parent, isMain) {
  if (parent?.filename === controllerPath && dependencies.has(request))
    return dependencies.get(request);
  return originalLoad.call(this, request, parent, isMain);
};
let forgotPassword;
try {
  ({ forgotPassword } = require(controllerPath));
} finally {
  Module._load = originalLoad;
}

test('answers password recovery before looking up the account', async () => {
  const response = {
    statusCode: null,
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
  const nextErrors = [];

  try {
    forgotPassword(
      { body: { email: 'user@example.test' }, protocol: 'https', get: () => 'shop.example.test' },
      response,
      (error) => nextErrors.push(error),
    );

    assert.equal(response.statusCode, 200);
    assert.match(response.body.message, /Si el correo está registrado/);
    assert.deepEqual(nextErrors, []);
  } finally {
    resolveUserLookup(null);
    await new Promise(setImmediate);
  }
});

test('still emails a registered account after returning the generic response', async () => {
  const user = {
    email: 'registered@example.test',
    async save() {
      savedUsers.push(this);
    },
  };
  lookupUser = () => Promise.resolve(user);
  const response = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  forgotPassword(
    { body: { email: ' REGISTERED@example.test ' }, protocol: 'https', get: () => 'shop.example.test' },
    response,
    (error) => assert.fail(error),
  );
  await new Promise(setImmediate);

  assert.equal(response.statusCode, 200);
  assert.equal(savedUsers.length, 1);
  assert.match(user.resetPasswordToken, /^[a-f0-9]{64}$/);
  assert.equal(user.resetPasswordExpires - Date.now() <= 3600000, true);
  assert.equal(sentResetEmails.length, 1);
  assert.equal(sentResetEmails[0].email, 'registered@example.test');
  assert.match(sentResetEmails[0].url, /^https:\/\/shop\.example\.test\/reset-password\/[a-f0-9]{64}$/);
});

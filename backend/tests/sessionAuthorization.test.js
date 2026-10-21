const assert = require('node:assert/strict');
const test = require('node:test');
const User = require('../models/User');
const {
  requireAdmin,
  requireAdminMfaPreauth,
  requireOptionalAuth,
} = require('../middleware/authMiddleware');

let currentUser;
User.findById = () => ({ select: () => ({ lean: async () => currentUser }) });
function request(overrides = {}) {
  const req = {
    headers: { accept: 'application/json' },
    originalUrl: '/api/admin/dashboard',
    path: '/admin/dashboard',
    session: {
      user: { id: 'user-1', authVersion: 1 },
      destroy(callback) {
        req.session = null;
        callback();
      },
    },
    ...overrides,
  };
  return req;
}
function invoke(middleware, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      clearCookie() {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body });
      },
      redirect() {
        resolve({ status: 302 });
      },
    };
    Promise.resolve(
      middleware(req, res, (error) => (error ? reject(error) : resolve({ status: 200 }))),
    ).catch(reject);
  });
}
test.beforeEach(() => {
  currentUser = { _id: 'user-1', name: 'Example', role: 'admin', authVersion: 1 };
});
test('admin session issued without MFA, including a promoted customer, cannot authorize admin routes', async () => {
  assert.equal((await invoke(requireAdmin, request())).status, 403);
});
test('a session that completed MFA can authorize admin routes', async () => {
  const req = request();
  req.session.authLevel = 'mfa';
  assert.equal((await invoke(requireAdmin, req)).status, 200);
});
test('preauthentication is revoked when password version changes', async () => {
  const req = request();
  delete req.session.user;
  req.session.adminMfaPreauth = {
    userId: 'user-1',
    authVersion: 0,
    mode: 'enroll',
    expiresAt: Date.now() + 60000,
  };
  assert.equal((await invoke(requireAdminMfaPreauth, req)).status, 401);
  assert.equal(req.session?.adminMfaPreauth, undefined);
});
test('optional authentication permits guests and rejects revoked or deleted identities', async () => {
  assert.equal((await invoke(requireOptionalAuth, request({ session: {} }))).status, 200);
  currentUser.authVersion = 2;
  assert.equal((await invoke(requireOptionalAuth, request())).status, 401);
  currentUser = null;
  assert.equal((await invoke(requireOptionalAuth, request())).status, 401);
});

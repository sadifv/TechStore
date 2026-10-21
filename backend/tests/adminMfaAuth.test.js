const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const controllerPath = path.join(__dirname, '..', 'controllers', 'authController.js');
const middlewarePath = path.join(__dirname, '..', 'middleware', 'authMiddleware.js');
const originalLoad = Module._load;
process.env.SESSION_SECRET = 'admin-mfa-test-secret-long-enough-for-hkdf';
const admin = {
  _id: 'admin-id',
  name: 'Admin',
  email: 'admin@example.test',
  role: 'admin',
  authVersion: 1,
  comparePassword: async () => true,
  save: async () => {},
};
const User = {
  findOne: () => ({ select: async () => admin }),
  findOneAndUpdate(filter, update) {
    const query = {
      select: async () => {
        const versionMatches = filter.authVersion === admin.authVersion || (filter.$and?.[0]?.$or && (admin.authVersion === undefined || admin.authVersion === 0));
        if (!versionMatches) return null;
        if (update.$set?.adminMfaLastTotpStep !== undefined) {
          if (admin.adminMfaLastTotpStep >= update.$set.adminMfaLastTotpStep) return null;
          admin.adminMfaLastTotpStep = update.$set.adminMfaLastTotpStep;
        }
        if (update.$set?.adminMfaSecret) {
          if (admin.adminMfaEnabledAt) return null;
          Object.assign(admin, update.$set);
        }
        if (update.$pull?.adminMfaRecoveryHashes) {
          const hash = update.$pull.adminMfaRecoveryHashes;
          if (!admin.adminMfaRecoveryHashes?.includes(hash)) return null;
          admin.adminMfaRecoveryHashes = admin.adminMfaRecoveryHashes.filter(
            (entry) => entry !== hash,
          );
          if (update.$unset) for (const key of Object.keys(update.$unset)) delete admin[key];
        }
        return admin;
      },
    };
    return query;
  },
};
const mocks = new Map([
  ['../models/User', User],
  ['../config/mailer', { sendPasswordResetEmail: async () => {} }],
  ['../config/logger', { info() {}, warn() {}, error() {} }],
  ['../config/frontendUrl', { getFrontendBaseUrl: () => 'https://store.example.test' }],
]);
Module._load = function (request, parent, isMain) {
  if (parent?.filename === controllerPath && mocks.has(request)) return mocks.get(request);
  return originalLoad.call(this, request, parent, isMain);
};
let loginUser;
let confirmAdminMfaEnrollment;
let verifyAdminMfa;
try {
  ({ loginUser, confirmAdminMfaEnrollment, verifyAdminMfa } = require(controllerPath));
} finally {
  Module._load = originalLoad;
}
const mfa = require('../services/adminMfa');
const { requireAdminMfaPreauth } = require(middlewarePath);

function request() {
  const req = {
    body: { email: admin.email, password: 'correct-password' },
    session: {
      regenerate(callback) {
        this.user = undefined;
        this.adminMfaPreauth = undefined;
        callback();
      },
      save(callback) {
        callback();
      },
    },
  };
  return req;
}
function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('valid admin password creates only a time-limited enrollment session, never an authenticated user', async () => {
  const req = request();
  const res = response();
  await loginUser(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mfaEnrollmentRequired, true);
  assert.equal(req.session.user, undefined);
  assert.equal(req.session.adminMfaPreauth.mode, 'enroll');
  assert.ok(req.session.adminMfaPreauth.expiresAt > Date.now());
});

test('customer login keeps its existing single-step authenticated session', async () => {
  admin.role = 'user';
  const req = request();
  const res = response();
  await loginUser(req, res);
  assert.equal(res.body.success, true);
  assert.equal(req.session.user.role, 'user');
  assert.equal(req.session.adminMfaPreauth, undefined);
  admin.role = 'admin';
});

test('preauthentication rejects expired sessions and never accepts arbitrary session data', () => {
  const res = response();
  requireAdminMfaPreauth(
    { session: { adminMfaPreauth: { mode: 'verify', expiresAt: Date.now() - 1 } } },
    res,
    () => assert.fail('expired preauth passed'),
  );
  assert.equal(res.statusCode, 401);
});

test('enrollment activates only after TOTP and returns one-time recovery codes', async () => {
  delete admin.adminMfaEnabledAt;
  delete admin.adminMfaSecret;
  const secret = mfa.generateSecret();
  const req = request();
  req.adminMfaPreauth = {
    userId: admin._id,
    authVersion: admin.authVersion,
    mode: 'enroll',
    pendingSecret: secret,
  };
  req.body = { code: mfa.generateTotp(secret, Math.floor(Date.now() / 30_000)) };
  const res = response();
  await confirmAdminMfaEnrollment(req, res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.recoveryCodes.length, 10);
  assert.ok(admin.adminMfaEnabledAt instanceof Date);
  assert.equal(admin.adminMfaRecoveryHashes.length, 10);
  assert.ok(admin.adminMfaRecoveryHashes.every((hash) => !res.body.recoveryCodes.includes(hash)));
  assert.equal(req.session.user.role, 'admin');
  assert.equal(req.session.authLevel, 'mfa');
});

test('TOTP opens one authenticated session and the same time step cannot be replayed', async () => {
  const secret = mfa.generateSecret();
  Object.assign(admin, {
    adminMfaSecret: mfa.encryptSecret(secret),
    adminMfaEnabledAt: new Date(),
    adminMfaRecoveryHashes: [],
    adminMfaLastTotpStep: -1,
  });
  const code = mfa.generateTotp(secret, Math.floor(Date.now() / 30_000));
  const req = request();
  req.adminMfaPreauth = { userId: admin._id, authVersion: admin.authVersion, mode: 'verify' };
  req.body = { code };
  const first = response();
  await verifyAdminMfa(req, first);
  assert.equal(first.body.success, true);
  assert.equal(req.session.user.role, 'admin');
  assert.equal(req.session.authLevel, 'mfa');

  const replayRequest = request();
  replayRequest.adminMfaPreauth = {
    userId: admin._id,
    authVersion: admin.authVersion,
    mode: 'verify',
  };
  replayRequest.body = { code };
  const replay = response();
  await verifyAdminMfa(replayRequest, replay);
  assert.equal(replay.statusCode, 401);
  assert.equal(replayRequest.session.user, undefined);
});

test('recovery code is consumed once and can recover after SESSION_SECRET rotation', async () => {
  const recoveryCode = 'ABCD-1234';
  Object.assign(admin, {
    adminMfaSecret: mfa.encryptSecret(mfa.generateSecret()),
    adminMfaEnabledAt: new Date(),
    adminMfaRecoveryHashes: [mfa.hashRecoveryCode(recoveryCode)],
    adminMfaLastTotpStep: -1,
  });
  const req = request();
  req.adminMfaPreauth = { userId: admin._id, authVersion: admin.authVersion, mode: 'verify' };
  req.body = { recoveryCode };
  const res = response();
  await verifyAdminMfa(req, res);
  assert.equal(res.body.success, true);
  assert.deepEqual(admin.adminMfaRecoveryHashes, []);
  const replay = request();
  replay.adminMfaPreauth = { userId: admin._id, authVersion: admin.authVersion, mode: 'verify' };
  replay.body = { recoveryCode };
  const replayRes = response();
  await verifyAdminMfa(replay, replayRes);
  assert.equal(replayRes.statusCode, 401);

  Object.assign(admin, {
    adminMfaSecret: mfa.encryptSecret(mfa.generateSecret()),
    adminMfaEnabledAt: new Date(),
    adminMfaRecoveryHashes: [mfa.hashRecoveryCode(recoveryCode)],
  });
  process.env.SESSION_SECRET = 'rotated-admin-mfa-test-secret-long-enough';
  const rotated = request();
  rotated.adminMfaPreauth = { userId: admin._id, authVersion: admin.authVersion, mode: 'verify' };
  rotated.body = { recoveryCode };
  const rotatedRes = response();
  await verifyAdminMfa(rotated, rotatedRes);
  assert.equal(rotatedRes.body.mfaEnrollmentRequired, true);
  assert.equal(rotated.session.adminMfaPreauth.mode, 'enroll');
  assert.equal(admin.adminMfaEnabledAt, undefined);
});

test('password reset during MFA rejects the atomic enrollment update', async () => {
  delete admin.adminMfaEnabledAt;
  const secret = mfa.generateSecret();
  const req = request();
  req.adminMfaPreauth = {
    userId: admin._id,
    authVersion: admin.authVersion - 1,
    mode: 'enroll',
    pendingSecret: secret,
  };
  req.body = { code: mfa.generateTotp(secret, Math.floor(Date.now() / 30000)) };
  const res = response();
  await confirmAdminMfaEnrollment(req, res);
  assert.equal(res.statusCode, 409);
  assert.equal(req.session.user, undefined);
});

 test('legacy admin without stored authVersion can enroll with version zero', async () => {
  delete admin.authVersion; delete admin.adminMfaEnabledAt;
  const secret = mfa.generateSecret(); const req = request();
  req.adminMfaPreauth = { userId: admin._id, authVersion: 0, mode: 'enroll', pendingSecret: secret };
  req.body = { code: mfa.generateTotp(secret, Math.floor(Date.now() / 30000)) };
  const res = response(); await confirmAdminMfaEnrollment(req, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.success, true);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const { identifyStaff, budget, key } = require('../middleware/apiRateLimiter');

test('larger budget requires a current staff role and MFA, never a supplied role alone', async () => {
  const original = User.findById;
  try {
    for (const role of ['owner', 'admin', 'user']) {
      User.findById = () => ({
        select: () => ({ lean: async () => ({ _id: 'staff-id', role, authVersion: 2 }) }),
      });
      for (const authLevel of ['password', 'mfa']) {
        const req = {
          ip: '127.0.0.1',
          session: { authLevel, user: { id: 'staff-id', role: 'owner', authVersion: 2 } },
        };
        await identifyStaff(req, {}, (error) => {
          if (error) throw error;
        });
        const privileged = authLevel === 'mfa' && role !== 'user';
        assert.equal(budget(req), privileged ? 1000 : 150);
        assert.equal(key(req).startsWith('staff:'), privileged);
      }
    }
  } finally {
    User.findById = original;
  }
});

test('anonymous clients share the IP budget while verified staff accounts have separate keys', () => {
  assert.equal(budget({}), 150);
  assert.equal(key({ ip: '127.0.0.1' }), key({ ip: '127.0.0.1' }));
  assert.notEqual(
    key({ ip: '127.0.0.1', verifiedStaffId: 'owner-id' }),
    key({ ip: '127.0.0.1', verifiedStaffId: 'admin-id' }),
  );
});

test('revoked staff sessions lose the privileged budget and database failures fail closed', async () => {
  const original = User.findById;
  try {
    let destroyed = false;
    User.findById = () => ({
      select: () => ({ lean: async () => ({ _id: 'staff-id', role: 'owner', authVersion: 3 }) }),
    });
    const req = {
      session: {
        authLevel: 'mfa',
        user: { id: 'staff-id', authVersion: 2 },
        destroy: (callback) => {
          destroyed = true;
          callback();
        },
      },
    };
    await identifyStaff(req, { clearCookie() {} }, (error) => {
      if (error) throw error;
    });
    assert.equal(destroyed, true);
    assert.equal(budget(req), 150);
    User.findById = () => {
      throw new Error('Database unavailable');
    };
    let failure;
    await identifyStaff(req, {}, (error) => {
      failure = error;
    });
    assert.equal(failure.message, 'Database unavailable');
    assert.equal(req.verifiedStaffId, null);
  } finally {
    User.findById = original;
  }
});

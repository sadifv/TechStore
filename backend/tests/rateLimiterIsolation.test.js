const assert = require('node:assert/strict');
const test = require('node:test');
const {
  contactLimiter,
  newsletterLimiter,
  passwordRecoveryLimiter,
  passwordResetLimiter,
} = require('../middleware/rateLimiter');
const apiRouter = require('../routes/apiRoutes');

test('public sensitive operations use independent rate-limit buckets', () => {
  const limiters = [
    contactLimiter,
    newsletterLimiter,
    passwordRecoveryLimiter,
    passwordResetLimiter,
  ];

  assert.equal(new Set(limiters).size, limiters.length);
});

test('routes use the matching operation-specific limiter', () => {
  const routeFor = (path) => apiRouter.stack.find((layer) => layer.route?.path === path)?.route;

  assert.equal(routeFor('/contact').stack[0].handle, contactLimiter);
  assert.equal(routeFor('/newsletter').stack[0].handle, newsletterLimiter);
  assert.equal(routeFor('/auth/forgot-password').stack[0].handle, passwordRecoveryLimiter);
  assert.equal(routeFor('/auth/reset-password/:token').stack[0].handle, passwordResetLimiter);
});

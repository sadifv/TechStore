const assert = require('node:assert/strict');
const test = require('node:test');
const {
  contactLimiter,
  newsletterLimiter,
  passwordRecoveryLimiter,
  passwordResetLimiter,
  checkoutLimiter,
  loginLimiter,
  rateLimitStores,
  rateLimitConfig,
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

test('checkout and login use separate persistent Mongo buckets with their approved limits', () => {
  assert.notEqual(rateLimitStores.checkout, rateLimitStores.login);
  assert.equal(rateLimitStores.checkout.bucket, 'checkout');
  assert.equal(rateLimitStores.login.bucket, 'login');
  assert.deepEqual(rateLimitConfig.checkout, { windowMs: 15 * 60 * 1000, max: 10 });
  assert.deepEqual(rateLimitConfig.login, { windowMs: 10 * 60 * 1000, max: 5 });
  assert.equal(rateLimitStores.adminMfa.bucket, 'admin-mfa');
  assert.deepEqual(rateLimitConfig.adminMfa, { windowMs: 10 * 60 * 1000, max: 5 });
});

test('routes use the matching operation-specific limiter', () => {
  const routeFor = (path) => apiRouter.stack.find((layer) => layer.route?.path === path)?.route;

  assert.equal(routeFor('/contact').stack[0].handle, contactLimiter);
  assert.equal(routeFor('/newsletter').stack[0].handle, newsletterLimiter);
  assert.equal(routeFor('/auth/forgot-password').stack[0].handle, passwordRecoveryLimiter);
  assert.equal(routeFor('/auth/reset-password/:token').stack[0].handle, passwordResetLimiter);
});

test('dedicated checkout limiter is mounted only on the checkout POST route', () => {
  const orderRouter = require('../routes/orderRoutes');
  const checkout = orderRouter.stack.find((layer) => layer.route?.path === '/checkout')?.route;
  assert.equal(checkout?.methods.post, true);
  assert.equal(checkout.stack[0].handle, checkoutLimiter);
  assert.equal(
    orderRouter.stack.some(
      (layer) =>
        layer.route?.path === '/success' &&
        layer.route.stack.some((handler) => handler.handle === checkoutLimiter),
    ),
    false,
  );
});

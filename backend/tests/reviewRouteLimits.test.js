const test=require('node:test'),assert=require('node:assert/strict');
test('moderation retains the admin budget and does not consume the customer review write bucket',()=>{
  const router=require('../routes/reviewRoutes');const {adminLimiter,reviewWriteLimiter}=require('../middleware/rateLimiter');
  const route=path=>router.stack.find(layer=>layer.route?.path===path).route;
  assert.equal(route('/admin/reviews/:id').stack[1].handle,adminLimiter);
  assert.equal(route('/reviews/:productId').stack[1].handle,reviewWriteLimiter);
});

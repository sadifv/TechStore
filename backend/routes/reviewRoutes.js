const router = require('express').Router(),
  c = require('../controllers/reviewController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { reviewWriteLimiter, adminLimiter } = require('../middleware/rateLimiter');
router.get('/products/:productId/reviews', c.list);
router.get('/reviews/mine', requireAuth, c.mine);
router.put('/reviews/:productId', requireAuth, reviewWriteLimiter, c.save);
router.delete('/reviews/:productId', requireAuth, reviewWriteLimiter, c.withdraw);
router.get('/admin/reviews', requireAdmin, c.moderation);
router.patch('/admin/reviews/:id', requireAdmin, adminLimiter, c.moderate);
module.exports = router;

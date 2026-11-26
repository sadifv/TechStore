const router = require('express').Router(),
  c = require('../controllers/reviewController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { reviewWriteLimiter, adminLimiter } = require('../middleware/rateLimiter');
const reviewPhotoUpload = require('../middleware/reviewPhotoUpload');
router.get('/products/:productId/reviews', c.list);
router.get('/products/:productId/reviews/photo/:key', c.publicPhoto);
router.get('/reviews/mine', requireAuth, c.mine);
router.get('/reviews/mine/:productId/photo/:key', requireAuth, c.ownPhoto);
router.put('/reviews/:productId', requireAuth, reviewWriteLimiter, reviewPhotoUpload, c.save);
router.delete('/reviews/:productId', requireAuth, reviewWriteLimiter, c.withdraw);
router.get('/admin/reviews', requireAdmin, c.moderation);
router.get('/admin/reviews/:id/photo/:key', requireAdmin, c.moderationPhoto);
router.patch('/admin/reviews/:id', requireAdmin, adminLimiter, c.moderate);
module.exports = router;

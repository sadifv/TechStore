const router = require('express').Router(),
  c = require('../controllers/addressController');
const { requireAuth } = require('../middleware/authMiddleware');
const { addressWriteLimiter } = require('../middleware/rateLimiter');
router.use(requireAuth);
router.get('/', c.list);
router.post('/', addressWriteLimiter, c.add);
router.patch('/:id', addressWriteLimiter, c.edit);
router.delete('/:id', addressWriteLimiter, c.remove);
router.put('/:id/default', addressWriteLimiter, c.setDefault);
module.exports = router;

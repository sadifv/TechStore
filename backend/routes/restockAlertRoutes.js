const router = require('express').Router();
const c = require('../controllers/restockAlertController');
const limits = require('../middleware/rateLimiter');
router.post('/', limits.restockRequestLimiter, c.requestAlert);
router.post('/confirm', limits.restockConfirmLimiter, c.confirm);
router.post('/unsubscribe', limits.restockUnsubscribeLimiter, c.unsubscribe);
module.exports = router;

const router = require('express').Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const { markWhatsappOrderPaid, confirmWhatsappContact, cancelWhatsappOrder } = require('../controllers/orderController');

router.use(requireAdmin);
router.post('/:id/confirm-payment', markWhatsappOrderPaid);
router.post('/:id/confirm-contact', confirmWhatsappContact);
router.post('/:id/cancel', cancelWhatsappOrder);

module.exports = router;

const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { listFavorites, mutateFavorite } = require('../controllers/favoritesController');
router.use(requireAuth);
router.get('/', listFavorites);
router.put('/:productId', mutateFavorite);
router.delete('/:productId', mutateFavorite);
module.exports = router;

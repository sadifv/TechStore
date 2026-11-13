const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const { activeProductFilter } = require('../services/productAvailability');
const {
  categories,
  validatePreferences,
  selectGuidedProducts,
} = require('../services/guidedShopping');

exports.getGuidedRecommendations = async (req, res, next) => {
  const preferences = validatePreferences(req.body);
  if (!preferences)
    return res
      .status(400)
      .json({ success: false, error: 'Revisa categoría, uso y presupuesto (hasta $100.000).' });
  try {
    const products = await Product.find({
      ...activeProductFilter(),
      stock: { $gt: 0 },
      category: preferences.category === 'any' ? { $in: categories } : preferences.category,
    })
      .select(
        '_id name category image price stock specifications flashSale flashSaleEndsAt originalPrice',
      )
      .lean();
    const reservations = await Reservation.getReservedStockByProducts(
      products.map((product) => product._id),
    );
    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      products: selectGuidedProducts(products, reservations, preferences),
    });
  } catch (error) {
    return next(error);
  }
};

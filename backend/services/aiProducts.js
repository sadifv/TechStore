const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const { activeProductFilter } = require('./productAvailability');
const { toPublicProduct } = require('./productPricing');

const normalizeName = (value) => value.normalize('NFKC').toLocaleLowerCase('es');

const findMentionedProductIds = (reply, catalog) => {
  const text = normalizeName(reply);
  return catalog
    .filter((product) => product.name && text.includes(normalizeName(product.name)))
    .slice(0, 3)
    .map((product) => String(product._id));
};

const resolveAiProducts = async (ids) => {
  const validIds = [
    ...new Set(ids.filter((id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id))),
  ].slice(0, 60);
  if (!validIds.length) return [];
  const products = await Product.find({ ...activeProductFilter(), _id: { $in: validIds } })
    .select('_id name category image price stock flashSale flashSaleEndsAt originalPrice')
    .lean();
  const reservations = await Reservation.getReservedStockByProducts(products.map((p) => p._id));
  return products.map((product) => ({
    ...toPublicProduct(product),
    availableStock: Math.max(0, product.stock - (reservations.get(String(product._id)) || 0)),
  }));
};

module.exports = { findMentionedProductIds, resolveAiProducts };

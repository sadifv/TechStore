const Appearance = require('../models/StoreAppearance');
const { auditedHandler } = require('../services/adminAudit');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const { activeProductFilter } = require('../services/productAvailability');
const { toPublicProduct } = require('../services/productPricing');

const keys = ['setup', 'study', 'gaming', 'halloween', 'christmas'];
const activeProducts = (ids) => Product.find({ ...activeProductFilter(), _id: { $in: ids } });

exports.getCollections = async (req, res, next) => {
  try {
    const settings = await Appearance.findById('global').lean();
    const visibleKeys = keys.filter(
      (key) => !['halloween', 'christmas'].includes(key) || key === settings?.theme,
    );
    const groups = settings?.collections || {};
    const ids = visibleKeys.flatMap((key) => groups[key] || []);
    const products = await activeProducts(ids).lean();
    const reserved = products.length
      ? await Reservation.getReservedStockByProducts(products.map((product) => product._id))
      : new Map();
    const byId = new Map(
      products.map((product) => [
        String(product._id),
        {
          ...toPublicProduct(product),
          availableStock: Math.max(0, product.stock - (reserved.get(String(product._id)) || 0)),
        },
      ]),
    );
    const collections = Object.fromEntries(
      visibleKeys.map((key) => [
        key,
        (groups[key] || []).map((id) => byId.get(String(id))).filter(Boolean),
      ]),
    );
    res.set('Cache-Control', 'no-store').json({ success: true, collections });
  } catch (error) {
    next(error);
  }
};

exports.getSelection = async (req, res, next) => {
  try {
    const settings = await Appearance.findById('global').lean();
    res
      .set('Cache-Control', 'no-store')
      .json({ success: true, collections: settings?.collections || {} });
  } catch (error) {
    next(error);
  }
};

exports.updateSelection = async (req, res, next) => {
  try {
    const { key, ids } = req.body || {};
    if (
      !keys.includes(key) ||
      !Array.isArray(ids) ||
      ids.length > 8 ||
      ids.some((id) => typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id)) ||
      new Set(ids).size !== ids.length ||
      (await activeProducts(ids).countDocuments()) !== ids.length
    ) {
      return res
        .status(400)
        .json({ success: false, error: 'Selecciona hasta ocho productos activos distintos.' });
    }
    await Appearance.findOneAndUpdate(
      { _id: 'global' },
      { $set: { [`collections.${key}`]: ids } },
      { upsert: true, runValidators: true },
    );
    res.json({ success: true, key, productCount: ids.length });
  } catch (error) {
    next(error);
  }
};

exports.updateSelection = auditedHandler(exports.updateSelection, 'collection.updated', (body) => ({
  _id: 'global',
  collectionKey: body.key,
  productCount: body.productCount,
}));

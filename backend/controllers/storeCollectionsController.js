const Appearance = require('../models/StoreAppearance');
const StoreCollection = require('../models/StoreCollection');
const {
  validKey,
  mergeDefinitions,
  normalizeDefinition,
} = require('../services/storeCollectionDefinitions');
const { auditedHandler } = require('../services/adminAudit');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const { activeProductFilter } = require('../services/productAvailability');
const { toPublicProduct } = require('../services/productPricing');

const activeProducts = (ids) => Product.find({ ...activeProductFilter(), _id: { $in: ids } });
const loadDefinitions = async () => mergeDefinitions(await StoreCollection.find().lean());

exports.getCollections = async (req, res, next) => {
  try {
    const settings = await Appearance.findById('global').lean();
    const definitions = (await loadDefinitions()).filter(
      (entry) =>
        entry.enabled && (entry.theme === 'all' || entry.theme === (settings?.theme || 'normal')),
    );
    const visibleKeys = definitions.map(({ key }) => key);
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
    res.set('Cache-Control', 'no-store').json({ success: true, collections, definitions });
  } catch (error) {
    next(error);
  }
};

exports.getSelection = async (req, res, next) => {
  try {
    const settings = await Appearance.findById('global').lean();
    const selectedIds = [
      ...new Set(
        Object.values(settings?.collections || {})
          .flat()
          .map(String),
      ),
    ];
    const selectedProducts = selectedIds.length
      ? await Product.find({ _id: { $in: selectedIds } })
          .select('_id name')
          .lean()
      : [];
    res.set('Cache-Control', 'no-store').json({
      success: true,
      collections: settings?.collections || {},
      selectedProducts,
      definitions: await loadDefinitions(),
    });
  } catch (error) {
    next(error);
  }
};

exports.updateSelection = async (req, res, next) => {
  try {
    const { key, ids } = req.body || {};
    if (
      !validKey(key) ||
      Object.keys(req.body).some((field) => !['key', 'ids'].includes(field)) ||
      !Array.isArray(ids) ||
      ids.length > 8 ||
      ids.some((id) => typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id)) ||
      new Set(ids).size !== ids.length ||
      !(await loadDefinitions()).some((definition) => definition.key === key) ||
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

exports.updateDefinition = async (req, res, next) => {
  try {
    const definition = normalizeDefinition(req.body);
    if (!definition)
      return res.status(400).json({ success: false, error: 'Datos de colección inválidos.' });
    const definitions = await loadDefinitions();
    const existing = definitions.find(({ key }) => key === definition.key);
    if (definition.remove && !existing)
      return res.status(404).json({ success: false, error: 'Colección no encontrada.' });
    if (!definition.remove && !existing && definitions.length >= 20) {
      return res
        .status(400)
        .json({ success: false, error: 'Puedes administrar hasta veinte colecciones.' });
    }
    const { key, remove, ...values } = definition;
    await StoreCollection.findOneAndUpdate(
      { _id: key },
      {
        $set: remove
          ? {
              title: existing.title,
              theme: existing.theme,
              order: existing.order,
              removed: true,
              enabled: false,
            }
          : values,
      },
      { upsert: true, runValidators: true },
    );
    // Serialize collection writes through the global appearance document and remove only membership.
    await Appearance.findOneAndUpdate(
      { _id: 'global' },
      remove
        ? { $unset: { [`collections.${key}`]: '' }, $set: { updatedAt: new Date() } }
        : { $set: { updatedAt: new Date() } },
      { upsert: true, runValidators: true },
    );
    res.set('Cache-Control', 'no-store').json({
      success: true,
      key,
      collectionKey: key,
      title: remove ? existing.title : values.title,
      enabled: !remove && values.enabled,
      order: remove ? existing.order : values.order,
    });
  } catch (error) {
    next(error);
  }
};
exports.updateDefinition = auditedHandler(
  exports.updateDefinition,
  'collection.updated',
  (body) => ({
    _id: 'global',
    collectionKey: body.key,
    title: body.title,
    enabled: body.enabled,
    order: body.order,
  }),
);

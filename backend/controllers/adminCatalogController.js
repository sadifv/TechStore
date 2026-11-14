const Product = require('../models/Product');
const Contact = require('../models/Contact');
const { auditedHandler } = require('../services/adminAudit');

const invalidQuery = () =>
  Object.assign(new Error('Filtros administrativos inválidos.'), { statusCode: 400 });
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseListingQuery(query = {}, products = false) {
  const allowed = products ? ['page', 'limit', 'q', 'category', 'status'] : ['page', 'limit', 'q'];
  if (Object.keys(query).some((key) => !allowed.includes(key))) throw invalidQuery();
  const integer = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max)
      throw invalidQuery();
    return Number(value);
  };
  const text = (value, max) => {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > max || /[\p{Cc}\p{Cf}]/u.test(value))
      throw invalidQuery();
    return value.trim();
  };
  const page = integer(query.page, 1, 10000);
  const limit = integer(query.limit, 20, 50);
  const q = text(query.q, 100);
  const filter = {};
  if (products) {
    const status = query.status === undefined ? 'active' : query.status;
    if (!['active', 'archived'].includes(status)) throw invalidQuery();
    filter.archivedAt = status === 'archived' ? { $ne: null } : null;
    const category = text(query.category, 100);
    if (category) filter.category = category;
  }
  if (q) {
    const expression = { $regex: escapeRegex(q), $options: 'i' };
    if (products) filter.name = expression;
    else filter.$or = ['name', 'email', 'message'].map((field) => ({ [field]: expression }));
  }
  return { page, limit, filter };
}

const listing =
  (Model, key, products = false) =>
  async (req, res, next) => {
    try {
      const { page: requestedPage, limit, filter } = parseListingQuery(req.query, products);
      const totalCount = await Model.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));
      const currentPage = Math.min(requestedPage, totalPages);
      const projection = products
        ? '_id name description price category stock image gallery specifications archivedAt flashSale originalPrice flashSaleDiscount flashSaleEndsAt createdAt updatedAt'
        : '_id name email message createdAt';
      const items = await Model.find(filter)
        .select(projection)
        .sort({ createdAt: -1, _id: -1 })
        .skip((currentPage - 1) * limit)
        .limit(limit)
        .lean();
      return res.set('Cache-Control', 'no-store').json({
        success: true,
        data: {
          [key]: items,
          pagination: { currentPage, totalPages, totalCount, limit },
        },
      });
    } catch (error) {
      return next(error);
    }
  };

const restoreProduct = async (req, res, next) => {
  try {
    if (
      !/^[a-f\d]{24}$/i.test(req.params.id || '') ||
      (req.body !== undefined &&
        (!req.body ||
          typeof req.body !== 'object' ||
          Array.isArray(req.body) ||
          Object.keys(req.body).length))
    ) {
      return res.status(400).json({ success: false, error: 'Solicitud de restauración inválida.' });
    }
    // Restore visibility only; stock, reservations, prices and order snapshots stay unchanged.
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, archivedAt: { $ne: null } },
      { $set: { archivedAt: null } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!product)
      return res.status(404).json({ success: false, error: 'Producto archivado no encontrado.' });
    return res.json({ success: true, data: product });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  parseListingQuery,
  getProducts: listing(Product, 'products', true),
  getMessages: listing(Contact, 'messages'),
  restoreProduct: auditedHandler(restoreProduct, 'product.restored'),
};

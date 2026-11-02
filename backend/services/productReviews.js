const Review = require('../models/ProductReview'),
  Order = require('../models/Order'),
  Product = require('../models/Product'),
  User = require('../models/User');
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const validId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
function validateReview(input = {}) {
  if (
    !Number.isInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5 ||
    typeof input.text !== 'string' ||
    input.text.length > 2000 ||
    input.text.trim().length < 10 ||
    /[<>\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input.text)
  )
    throw fail('Usa una puntuación de 1 a 5 y texto plano de 10 a 2000 caracteres.');
  return { rating: input.rating, text: input.text.trim() };
}
async function eligible(user, product) {
  return Boolean(
    await Order.exists({
      user,
      paymentStatus: 'paid',
      status: { $in: ['delivered', 'completed'] },
      'items.product': product,
    }),
  );
}
function reviewId(user, product) {
  if (!validId(String(user)) || !validId(product)) throw fail('Producto inválido.');
  return `${product.toLowerCase()}:${String(user).toLowerCase()}`;
}
async function mine(user, product) {
  const id = reviewId(user, product);
  return {
    review: await Review.findById(id).select('-moderationEvents -user -__v').lean(),
    eligible: await eligible(user, product),
  };
}
async function saveReview(user, product, input) {
  const id = reviewId(user, product),
    value = validateReview(input);
  if (!(await Product.exists({ _id: product, archivedAt: null })))
    throw fail('Producto no disponible.', 404);
  if (!(await eligible(user, product)))
    throw fail('Necesitas una compra propia pagada y entregada para reseñar este producto.', 403);
  const old = await Review.findById(id).lean();
  if (old) {
    if (!Number.isInteger(input.version) || input.version !== old.version)
      throw fail('La reseña cambió. Actualiza e inténtalo de nuevo.', 409);
    const updated = await Review.findOneAndUpdate(
      { _id: id, version: input.version },
      { $set: { ...value, status: 'pending', withdrawn: false }, $inc: { version: 1 } },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) throw fail('La reseña cambió. Actualiza e inténtalo de nuevo.', 409);
    return updated;
  }
  const account = await User.findById(user).select('name').lean();
  const authorLabel =
    (account?.name || 'Comprador')
      .split(/\s/)[0]
      .split('@')[0]
      .replace(/[^\p{L}\p{N}'-]/gu, '')
      .slice(0, 24) || 'Comprador';
  try {
    return (
      await Review.create({
        _id: id,
        product,
        user,
        ...value,
        authorLabel,
        status: 'pending',
        version: 1,
      })
    ).toObject();
  } catch (e) {
    if (e.code === 11000) throw fail('La reseña cambió. Actualiza e inténtalo de nuevo.', 409);
    throw e;
  }
}
async function withdrawReview(user, product, version) {
  const id = reviewId(user, product);
  if (!Number.isInteger(version)) throw fail('Versión inválida.');
  const row = await Review.findOneAndUpdate(
    { _id: id, version },
    { $set: { withdrawn: true, status: 'hidden' }, $inc: { version: 1 } },
    { returnDocument: 'after' },
  ).lean();
  if (!row) throw fail('La reseña cambió. Actualiza e inténtalo de nuevo.', 409);
  return row;
}
async function moderateReview(actor, id, { status, version } = {}) {
  if (
    typeof id !== 'string' ||
    !/^[a-f0-9]{24}:[a-f0-9]{24}$/i.test(id) ||
    !['approved', 'rejected', 'hidden'].includes(status) ||
    !Number.isInteger(version)
  )
    throw fail('Decisión o versión inválida.');
  const old = await Review.findById(id).lean();
  if (!old) throw fail('Reseña no encontrada.', 404);
  if (status === 'approved' && String(old.user) === String(actor))
    throw fail('No puedes aprobar tu propia reseña.', 403);
  const row = await Review.findOneAndUpdate(
    { _id: id, version, withdrawn: { $ne: true } },
    {
      $set: { status },
      $inc: { version: 1 },
      $push: {
        moderationEvents: { $each: [{ actor, at: new Date(), status, version }], $slice: -50 },
      },
    },
    { returnDocument: 'after' },
  ).lean();
  if (!row) throw fail('La reseña cambió o fue retirada. Actualiza la lista.', 409);
  return row;
}
async function listPublicReviews(product, page = 1) {
  if (!validId(product)) throw fail('Producto inválido.');
  page = Math.max(1, Math.min(1000, parseInt(page, 10) || 1));
  const filter = { product, status: 'approved', withdrawn: { $ne: true } };
  const rows = await Review.find(filter)
    .select('rating text authorLabel createdAt updatedAt -_id')
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * 10)
    .limit(10)
    .lean();
  const totals = await Review.aggregate([
    { $match: { ...filter, product: new (require('mongoose').Types.ObjectId)(product) } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return {
    reviews: rows.map((r) => ({
      rating: r.rating,
      text: r.text,
      author: r.authorLabel || 'Comprador',
      createdAt: r.createdAt,
      verifiedPurchase: true,
    })),
    average: totals[0]?.average || 0,
    count: totals[0]?.count || 0,
    page,
    totalPages: Math.max(1, Math.ceil((totals[0]?.count || 0) / 10)),
  };
}
async function listModeration(status = 'pending', page = 1) {
  status = ['pending', 'approved', 'rejected', 'hidden'].includes(status) ? status : 'pending';
  page = Math.max(1, Math.min(1000, parseInt(page, 10) || 1));
  const filter = { status, withdrawn: { $ne: true } };
  const rows = await Review.find(filter)
    .sort({ updatedAt: 1, _id: 1 })
    .skip((page - 1) * 20)
    .limit(20)
    .lean();
  const products = await Product.find({ _id: { $in: rows.map((r) => r.product) } })
    .select('name')
    .lean();
  const names = new Map(products.map((p) => [String(p._id), p.name]));
  const count = await Review.countDocuments(filter);
  return {
    reviews: rows.map((r) => ({
      ...r,
      productName: names.get(String(r.product)) || 'Producto retirado',
    })),
    page,
    totalPages: Math.max(1, Math.ceil(count / 20)),
    count,
  };
}
module.exports = {
  validateReview,
  saveReview,
  withdrawReview,
  moderateReview,
  listPublicReviews,
  listModeration,
  mine,
};

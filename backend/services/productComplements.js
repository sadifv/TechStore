const Product = require('../models/Product');
const { activeProductFilter } = require('./productAvailability');

const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });

async function resolveProductComplements(raw, productId) {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || raw.replace(/\r\n/g, '\n').length > 302)
    throw invalid('Escribe hasta tres nombres de productos, uno por línea.');

  const names = [
    ...new Set(
      raw
        .split(/\r?\n/)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  if (names.length > 3 || names.some((name) => name.length > 100 || /[\p{Cc}\p{Cf}]/u.test(name)))
    throw invalid('Escribe hasta tres nombres de productos, uno por línea.');
  if (!names.length) return [];

  const matches = await Product.find({ ...activeProductFilter(), name: { $in: names } })
    .select('_id name')
    .limit(4)
    .lean();
  return names.map((name) => {
    const products = matches.filter((entry) => entry.name === name);
    if (products.length !== 1 || String(products[0]._id) === String(productId))
      throw invalid(
        'Cada complemento debe identificar un producto activo distinto y sin nombres duplicados.',
      );
    return { productId: products[0]._id, name };
  });
}

module.exports = { resolveProductComplements };

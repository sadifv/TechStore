const Product = require('../models/Product');
const { activeProductFilter } = require('./productAvailability');

const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });

function parseComplements(raw, details) {
  const invalidFormat = () =>
    invalid('Agrega hasta tres complementos con nombres de hasta 100 caracteres y motivos de hasta 160.');
  let rows;
  if (details !== undefined) {
    if (raw !== undefined || typeof details !== 'string' || details.length > 4096)
      throw invalidFormat();
    try {
      rows = JSON.parse(details);
    } catch {
      throw invalidFormat();
    }
  } else {
    if (typeof raw !== 'string' || raw.length > 4096) throw invalidFormat();
    if (raw.replace(/\r\n/g, '\n').length > 302) throw invalidFormat();
    rows = [...new Set(raw.split(/\r?\n/).map((name) => name.trim()).filter(Boolean))].map(
      (name) => ({ name }),
    );
  }
  const boundedText = (value, length) =>
    typeof value === 'string' && value.trim().length <= length && !/[\p{Cc}\p{Cf}]/u.test(value);
  if (
    !Array.isArray(rows) ||
    rows.length > 3 ||
    rows.some(
      (row) =>
        !row ||
        Array.isArray(row) ||
        typeof row !== 'object' ||
        Object.keys(row).some((key) => key !== 'name' && key !== 'reason') ||
        !boundedText(row.name, 100) ||
        !row.name.trim() ||
        (row.reason !== undefined && !boundedText(row.reason, 160)),
    )
  )
    throw invalidFormat();
  return rows.map(({ name, reason }) => ({ name: name.trim(), reason: reason?.trim() }));
}

async function resolveProductComplements(raw, productId, existing = [], details) {
  if (raw === undefined && details === undefined) return undefined;
  const rows = parseComplements(raw, details);
  const stored = new Map(existing.map((row) => [row.name, row]));
  const names = rows.map(({ name }) => name);
  const ambiguous = () =>
    invalid('Cada complemento debe identificar un producto activo distinto y sin nombres duplicados.');
  if (new Set(names).size !== names.length) throw ambiguous();
  const newNames = names.filter((name) => !stored.has(name));
  const matches = newNames.length
    ? await Product.find({ ...activeProductFilter(), name: { $in: newNames } })
        .select('_id name')
        .limit(4)
        .lean()
    : [];
  const resolved = rows.map(({ name, reason }) => {
    const previous = stored.get(name);
    const products = matches.filter((entry) => entry.name === name);
    const target = previous?.productId ?? (products.length === 1 ? products[0]._id : null);
    if (!target || String(target) === String(productId)) throw ambiguous();
    const explanation = reason ?? previous?.reason;
    return { productId: target, name, ...(explanation ? { reason: explanation } : {}) };
  });
  if (new Set(resolved.map((row) => String(row.productId))).size !== resolved.length)
    throw ambiguous();
  return resolved;
}

module.exports = { resolveProductComplements };

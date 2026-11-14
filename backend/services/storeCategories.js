const StoreCategories = require('../models/StoreCategories');

const defaultNames = [
  'Laptops',
  'Smartphones',
  'Audio',
  'Accesorios',
  'Periféricos',
  'Monitores',
  'Almacenamiento',
  'Componentes',
  'Gaming',
  'Redes',
  'Cocina y hogar',
  'Muebles',
];
const defaultCategories = defaultNames.map((name, order) => ({
  id: `category-${order + 1}`,
  name,
  image: '',
  order,
  aliases: [],
}));
const invalid = (message = 'Revisa los nombres, imágenes y orden de las categorías.') =>
  Object.assign(new Error(message), { statusCode: 400 });
const normalizeName = (name) => {
  if (
    typeof name !== 'string' ||
    name.trim().length < 2 ||
    name.trim().length > 80 ||
    name.trim().toLowerCase() === 'all' ||
    /[<>\u0000-\u001f\u007f]/u.test(name)
  )
    throw invalid();
  return name.trim().normalize('NFC');
};
function normalizeImage(image) {
  if (
    typeof image !== 'string' ||
    image.length > 1000 ||
    /[\s\\<>\u0000-\u001f\u007f]/u.test(image)
  )
    throw invalid();
  if (!image) return '';
  if (/^\/(?:images|uploads)\/[a-zA-Z0-9_./-]+$/.test(image) && !image.includes('..')) return image;
  try {
    const url = new URL(image);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.hash) return url.href;
  } catch {
    /* Rejected below. */
  }
  throw invalid('Usa una imagen HTTPS o una ruta de imágenes de la tienda.');
}
function normalizeCategoryList(body, previous) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !['revision', 'categories'].includes(key)) ||
    !Number.isSafeInteger(body.revision) ||
    body.revision < 0 ||
    !Array.isArray(body.categories) ||
    body.categories.length < 1 ||
    body.categories.length > 40
  )
    throw invalid();
  const byId = new Map(previous.map((entry) => [entry.id, entry]));
  const entries = body.categories.map((entry, order) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      Object.keys(entry).some((key) => !['id', 'name', 'image', 'order'].includes(key)) ||
      typeof entry.id !== 'string' ||
      !/^[a-z][a-z0-9-]{0,59}$/.test(entry.id) ||
      entry.order !== order
    )
      throw invalid();
    const name = normalizeName(entry.name);
    const old = byId.get(entry.id);
    const aliases = [
      ...new Set([...(old?.aliases || []), ...(old && old.name !== name ? [old.name] : [])]),
    ].filter((alias) => alias !== name);
    if (aliases.length > 40)
      throw invalid('Esta categoría alcanzó el límite de nombres anteriores.');
    return { id: entry.id, name, image: normalizeImage(entry.image), order, aliases };
  });
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw invalid();
  const names = new Set();
  for (const entry of entries) {
    for (const name of [entry.name, ...entry.aliases]) {
      const normalized = name.toLocaleLowerCase('es');
      if (names.has(normalized))
        throw invalid('Los nombres y nombres anteriores no pueden repetirse.');
      names.add(normalized);
    }
  }
  return entries;
}
async function getCategorySettings() {
  return (
    (await StoreCategories.findById('global').lean()) || {
      revision: 0,
      categories: defaultCategories,
    }
  );
}
module.exports = { defaultCategories, normalizeCategoryList, getCategorySettings };

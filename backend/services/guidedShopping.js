const { toPublicProduct } = require('./productPricing');

const categories = ['Laptops', 'Audio', 'Periféricos'];
const uses = {
  estudiar: /ram|memoria|procesador|microfono|teclado/i,
  trabajar: /ram|memoria|procesador|ergonom|conexion|teclado/i,
  jugar: /grafica|gpu|hz|latencia|gaming/i,
  videollamadas: /microfono|camara|webcam/i,
  musica: /audio|cancelacion|frecuencia|sonido|driver/i,
};
const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function validatePreferences(body) {
  if (
    !body ||
    ![...categories, 'any'].includes(body.category) ||
    typeof body.use !== 'string' ||
    !Object.hasOwn(uses, body.use)
  )
    return null;
  const budget = body.budget;
  if (
    budget !== null &&
    (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0 || budget > 100000)
  )
    return null;
  return { category: body.category, use: body.use, budget };
}

function selectGuidedProducts(products, reservations, preferences, now = Date.now()) {
  return products
    .map((product) => {
      const item = toPublicProduct(product, now);
      const availableStock = Math.max(0, item.stock - (reservations.get(String(item._id)) || 0));
      const evidence = (item.specifications || []).filter(({ name, value }) =>
        uses[preferences.use].test(normalize(`${name} ${value}`)),
      );
      return { ...item, availableStock, evidence };
    })
    .filter(
      (item) =>
        item.availableStock > 0 &&
        Number.isFinite(item.price) &&
        item.price >= 0 &&
        categories.includes(item.category) &&
        (preferences.category === 'any' || item.category === preferences.category) &&
        (preferences.budget === null || item.price <= preferences.budget),
    )
    .sort(
      (a, b) =>
        b.evidence.length - a.evidence.length ||
        a.price - b.price ||
        String(a._id).localeCompare(String(b._id)),
    )
    .slice(0, 3)
    .map(({ evidence, ...item }) => ({
      ...item,
      reasons: [
        preferences.budget === null
          ? 'Sin límite de presupuesto indicado.'
          : 'Dentro de tu presupuesto máximo.',
        ...evidence.slice(0, 2).map(({ name, value }) => `${name}: ${value}`),
        evidence.length
          ? 'Datos relacionados con el uso elegido; confirma los requisitos de tus programas o dispositivos.'
          : 'Faltan especificaciones para valorar el uso elegido; consulta con la tienda antes de decidir.',
      ],
    }));
}
module.exports = { categories, validatePreferences, selectGuidedProducts };

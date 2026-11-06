const invalidSpecifications = () => {
  const error = new Error(
    'Especificaciones inválidas: usa hasta 20 pares de nombre (1–40) y valor (1–200), sin HTML ni nombres repetidos.',
  );
  error.status = 400;
  error.statusCode = 400;
  return error;
};

const normalizeSpecifications = (raw) => {
  if (raw === undefined) return undefined;
  let pairs = raw;
  if (typeof pairs === 'string') {
    // Bound parsing work to the maximum useful multipart payload.
    if (pairs.length > 64 * 1024) throw invalidSpecifications();
    try {
      pairs = JSON.parse(pairs);
    } catch {
      throw invalidSpecifications();
    }
  }
  if (!Array.isArray(pairs) || pairs.length > 20) throw invalidSpecifications();
  const names = new Set();
  return Array.from(pairs, (pair) => {
    if (
      !pair ||
      typeof pair !== 'object' ||
      Array.isArray(pair) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(pair)) ||
      Object.keys(pair).length !== 2 ||
      !Object.hasOwn(pair, 'name') ||
      !Object.hasOwn(pair, 'value') ||
      typeof pair.name !== 'string' ||
      typeof pair.value !== 'string'
    )
      throw invalidSpecifications();
    const name = pair.name.trim();
    const value = pair.value.trim();
    if (
      !name ||
      name.length > 40 ||
      !value ||
      value.length > 200 ||
      /[<>\u0000-\u001f\u007f]/.test(name + value)
    )
      throw invalidSpecifications();
    const key = name.normalize('NFKC').toLocaleLowerCase('es');
    if (names.has(key)) throw invalidSpecifications();
    names.add(key);
    return { name, value };
  });
};

module.exports = { normalizeSpecifications };

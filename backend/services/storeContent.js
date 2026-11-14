const defaults = Object.freeze({
  email: 'sadiflores20201@gmail.com',
  location: 'Villa España, Guayaquil, Ecuador',
  hours: 'Lunes a Viernes, 9:00–16:00',
  instagram: 'https://www.instagram.com/whois.sadi.lm/',
  heroLead: 'Escucha cada',
  heroAccent: 'detalle.',
  heroSubtitle: 'Laptops, audio y periféricos. Tu próximo equipo empieza aquí.',
  heroImage: '/images/experience/audio-assembled-1280.webp',
  heroDetailImage: '/images/experience/audio-exploded-1280.webp',
  heroImageAlt: 'Auriculares de referencia en grafito, con detalles azules',
  chapter1Title: 'El primer contacto.',
  chapter1Text: 'Explora laptops, audio y periféricos en Ecuador.',
  chapter2Title: 'Mira lo que hay dentro.',
  chapter2Text: 'Una mirada distinta a la tecnología que eliges.',
  chapter3Title: 'Encuentra lo que va contigo.',
  chapter3Text: 'Explora el catálogo y coordina tu pedido por WhatsApp.',
  buildTitle: 'Cada pieza cuenta.',
  buildSubtitle: 'Empieza por la base.',
  buildText: 'Explora procesadores, placas y memoria para elegir la base de tu PC.',
  buildImage: '',
  buildImageAlt: 'Componentes para tu PC',
  contactTitle: '¿Encontraste lo que buscabas? Hablemos.',
  contactText: 'Consulta sobre un producto o coordina tu pedido con TechStore.',
  footerText: 'Laptops, audio y periféricos en Ecuador. Coordina tu pedido por WhatsApp.',
});
const imageKeys = new Set(['heroImage', 'heroDetailImage', 'buildImage']);
const limits = Object.fromEntries(
  Object.keys(defaults).map((key) => [
    key,
    imageKeys.has(key) || key === 'instagram'
      ? 500
      : key === 'email'
        ? 254
        : key.endsWith('Text') || ['heroSubtitle', 'buildText', 'contactText'].includes(key)
          ? 240
          : 120,
  ]),
);
function safeImage(value) {
  if (/^\/(images|uploads)\/[a-zA-Z0-9/_\-.]+$/.test(value))
    return !value.includes('..') && !/\.svg$/i.test(value);
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      !/\.svg$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}
function normalizeContent(body) {
  const invalid = () =>
    Object.assign(new Error('Revisa los campos de contenido de la tienda.'), { statusCode: 400 });
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !['content', 'revision'].includes(key)) ||
    !Number.isSafeInteger(body.revision) ||
    body.revision < 0 ||
    !body.content ||
    typeof body.content !== 'object' ||
    Array.isArray(body.content)
  )
    throw invalid();
  const entries = Object.entries(body.content);
  if (!entries.length || entries.some(([key]) => !Object.hasOwn(defaults, key))) throw invalid();
  const normalized = {};
  for (const [key, value] of entries) {
    if (
      typeof value !== 'string' ||
      value.length > limits[key] ||
      /[\u0000-\u001f\u007f<>]/u.test(value)
    )
      throw invalid();
    const text = value.trim();
    if (!text && !['buildImage', 'instagram'].includes(key)) throw invalid();
    if (imageKeys.has(key) && text && !safeImage(text)) throw invalid();
    if (key === 'email' && !require('./emailAddress').isSingleEmail(text)) throw invalid();
    if (key === 'instagram' && text) {
      let url;
      try {
        url = new URL(text);
      } catch {
        throw invalid();
      }
      if (
        url.protocol !== 'https:' ||
        !['instagram.com', 'www.instagram.com'].includes(url.hostname) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw invalid();
    }
    normalized[key] = text;
  }
  return normalized;
}
module.exports = { defaults, limits, normalizeContent, safeImage };

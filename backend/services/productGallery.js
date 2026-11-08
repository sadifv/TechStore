function normalizeMainImage(raw) {
  if (raw === undefined || raw === '') return undefined;
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) return undefined;
    if (/^\/images\/products\/[a-z0-9_-]+\.(?:svg|png|jpe?g|webp|gif)$/i.test(value)) return value;
    return normalizeGallery([value])[0];
  }
  throw Object.assign(new Error('La imagen principal debe ser un enlace HTTPS válido.'), {
    status: 400,
    statusCode: 400,
  });
}

function normalizeGallery(raw) {
  if (raw === undefined) return undefined;
  const urls =
    typeof raw === 'string'
      ? raw
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      : raw;
  if (
    Array.isArray(urls) &&
    urls.length <= 5 &&
    urls.every((value) => {
      if (typeof value !== 'string' || value.length > 2048 || /\s/.test(value)) return false;
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password;
      } catch {
        return false;
      }
    })
  )
    return [...new Set(urls)];
  throw Object.assign(new Error('Agrega hasta cinco enlaces HTTPS válidos para la galería.'), {
    status: 400,
    statusCode: 400,
  });
}
module.exports = { normalizeGallery, normalizeMainImage };

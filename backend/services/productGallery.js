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
module.exports = { normalizeGallery };

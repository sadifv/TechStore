const getBackendBaseUrl = () => {
  const configuredUrl = process.env.API_URL;
  if (!configuredUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'API_URL HTTPS es obligatorio para crear sesiones de Checkout en producción.',
      );
    }
    return `http://localhost:${process.env.PORT || 3001}`;
  }

  const parsedUrl = new URL(configuredUrl);
  if (
    !['http:', 'https:'].includes(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== '/' ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error('API_URL debe ser un origen HTTP(S) sin ruta ni credenciales.');
  }
  if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
    throw new Error('API_URL debe usar HTTPS en producción.');
  }
  return parsedUrl.origin;
};

module.exports = { getBackendBaseUrl };

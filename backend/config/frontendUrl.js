const getFrontendBaseUrl = () => {
  const configuredUrl =
    process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'production' ? process.env.APP_URL : 'http://localhost:5173');
  return configuredUrl ? configuredUrl.replace(/\/+$/, '') : null;
};

const redirectToFrontend = (req, res, path = req.originalUrl) => {
  // Express pasa `next` como tercer argumento al usar este helper como ruta.
  // Solo tratar `path` como texto cuando se invoque explícitamente con una ruta.
  const targetPath = typeof path === 'string' ? path : req.originalUrl || '/';
  const baseUrl = getFrontendBaseUrl();
  if (!baseUrl) {
    return res.status(503).send('Configure FRONTEND_URL para redirigir a la aplicación React.');
  }
  return res.redirect(302, `${baseUrl}${targetPath.startsWith('/') ? targetPath : `/${targetPath}`}`);
};

module.exports = { getFrontendBaseUrl, redirectToFrontend };

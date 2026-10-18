const getFrontendBaseUrl = () => {
    const configuredUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? process.env.APP_URL : 'http://localhost:5173');
    return configuredUrl ? configuredUrl.replace(/\/+$/, '') : null;
};

const redirectToFrontend = (req, res, path = req.originalUrl) => {
    const baseUrl = getFrontendBaseUrl();
    if (!baseUrl) {
        return res.status(503).send('Configure FRONTEND_URL para redirigir a la aplicación React.');
    }
    return res.redirect(302, `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
};

module.exports = { getFrontendBaseUrl, redirectToFrontend };

// middleware/authMiddleware.js

// Añade el usuario actual a `res.locals`
const setUserLocals = (req, res, next) => {
    res.locals.user = req.user || req.session?.user || null;
    next();
};

const isApiRequest = (req) => {
    const requestPaths = [req.originalUrl, req.baseUrl, req.path];
    return req.xhr ||
        requestPaths.some(requestPath =>
            requestPath === '/api' || requestPath?.startsWith('/api/')
        ) ||
        req.headers.accept?.includes('json') ||
        req.headers['content-type']?.includes('json');
};

// Requiere rol admin
const requireAdmin = (req, res, next) => {
    const currentUser = req.user || req.session?.user;

    if (currentUser && currentUser.role === 'admin') {
        return next();
    }

    if (isApiRequest(req)) {
        return res.status(403).json({
            success: false,
            error: 'Acceso denegado. Se requieren permisos de administrador.'
        });
    }

    return res.status(403).redirect('/login');
};

// Requiere autenticación (cualquier rol)
const requireAuth = (req, res, next) => {
    const currentUser = req.user || req.session?.user;

    if (currentUser) {
        return next();
    }

    if (isApiRequest(req)) {
        return res.status(401).json({
            success: false,
            error: 'Debes iniciar sesión para realizar esta acción.'
        });
    }

    return res.redirect('/login');
};

// Redirige si ya está autenticado (para /login y /register)
const redirectIfAuthenticated = (req, res, next) => {
    const currentUser = req.user || req.session?.user;

    if (currentUser) {
        return res.redirect('/');
    }
    next();
};

module.exports = {
    setUserLocals,
    requireAdmin,
    requireAuth,
    redirectIfAuthenticated
};
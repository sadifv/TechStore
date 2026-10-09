const setUserLocals = (req, res, next) => {
    res.locals.user = req.user || req.session?.user || null;
    next();
};

const requireAdmin = (req, res, next) => {
    const currentUser = req.user || req.session?.user;
    if (currentUser && currentUser.role === 'admin') {
        return next();
    }

    // Si es petición API o AJAX
    if (req.xhr || req.headers.accept?.includes('json') || req.path.startsWith('/api')) {
        return res.status(403).json({
            success: false,
            error: 'Acceso denegado. Se requieren permisos de administrador.'
        });
    }

    return res.status(403).redirect('/login');
};

const requireAuth = (req, res, next) => {
    const currentUser = req.user || req.session?.user;
    if (currentUser) {
        return next();
    }
    
    // Si la solicitud requiere HTML (navegador), redirigir al login
    if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
        return res.redirect('/login');
    }
    
    // Si es una petición API (AJAX/fetch), retornar JSON de error
    return res.status(401).json({
        success: false,
        error: 'Debes iniciar sesión para realizar esta acción.'
    });
};

module.exports = {
    setUserLocals,
    requireAdmin,
    requireAuth
};
// middleware/authMiddleware.js
const isApiRequest = require('./isApiRequest');
const User = require('../models/User');

const requireAdminMfaPreauth = (req, res, next) => {
  const preauth = req.session?.adminMfaPreauth;
  if (!preauth || preauth.expiresAt <= Date.now() || !['enroll', 'verify'].includes(preauth.mode)) {
    return res
      .status(401)
      .json({ success: false, error: 'La sesión de verificación expiró. Inicia sesión de nuevo.' });
  }
  req.adminMfaPreauth = preauth;
  next();
};

const destroySession = (req, res) =>
  new Promise((resolve) => {
    if (!req.session) return resolve();
    req.session.destroy(() => {
      res.clearCookie('connect.sid', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      resolve();
    });
  });

const loadCurrentUser = async (req, res) => {
  const sessionUser = req.session?.user || req.user;
  const userId = sessionUser?.id || sessionUser?._id;
  if (!userId) return null;

  const user = await User.findById(userId).select('name email role +authVersion').lean();
  if (!user || Number(sessionUser.authVersion || 0) !== Number(user.authVersion || 0)) {
    await destroySession(req, res);
    return null;
  }

  const safeUser = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    authVersion: user.authVersion || 0,
  };
  if (req.session?.user) req.session.user = safeUser;
  req.user = safeUser;
  return safeUser;
};

// Añade el usuario actual a `res.locals`
const setUserLocals = (req, res, next) => {
  res.locals.user = req.user || req.session?.user || null;
  next();
};

// Requiere rol admin
const requireAdmin = (req, res, next) => {
  if (!(req.user || req.session?.user)) {
    if (isApiRequest(req)) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Se requieren permisos de administrador.',
      });
    }
    return res.redirect('/login');
  }

  loadCurrentUser(req, res)
    .then((currentUser) => {
      if (currentUser?.role === 'admin') return next();
      if (isApiRequest(req)) {
        return res.status(403).json({
          success: false,
          error: 'Acceso denegado. Se requieren permisos de administrador.',
        });
      }
      return res.redirect('/login');
    })
    .catch(next);
};

// Requiere autenticación (cualquier rol)
const requireAuth = (req, res, next) => {
  if (!(req.user || req.session?.user)) {
    if (isApiRequest(req)) {
      return res
        .status(401)
        .json({ success: false, error: 'Debes iniciar sesión para realizar esta acción.' });
    }
    return res.redirect('/login');
  }

  loadCurrentUser(req, res)
    .then((currentUser) => {
      if (currentUser) return next();
      if (isApiRequest(req)) {
        return res
          .status(401)
          .json({ success: false, error: 'Debes iniciar sesión para realizar esta acción.' });
      }
      return res.redirect('/login');
    })
    .catch(next);
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
  redirectIfAuthenticated,
  requireAdminMfaPreauth,
};

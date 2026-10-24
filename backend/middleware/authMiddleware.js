const { STAFF_ROLES, isStaff } = require('../services/userRoles');
// middleware/authMiddleware.js
const isApiRequest = require('./isApiRequest');
const User = require('../models/User');

const requireAdminMfaPreauth = async (req, res, next) => {
  const preauth = req.session?.adminMfaPreauth;
  const reject = () => {
    if (req.session) delete req.session.adminMfaPreauth;
    return res
      .status(401)
      .json({ success: false, error: 'La sesión de verificación expiró. Inicia sesión de nuevo.' });
  };
  if (
    !preauth ||
    !Number.isFinite(preauth.expiresAt) ||
    preauth.expiresAt <= Date.now() ||
    !['enroll', 'verify'].includes(preauth.mode)
  )
    return reject();
  try {
    const user = await User.findById(preauth.userId).select('role +authVersion').lean();
    if (
      !user ||
      !isStaff(user.role) ||
      !Number.isInteger(preauth.authVersion) ||
      preauth.authVersion !== (user.authVersion || 0)
    )
      return reject();
    req.adminMfaPreauth = preauth;
    return next();
  } catch (error) {
    return next(error);
  }
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
const requireRole = (allowedRoles) => (req, res, next) => {
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
      if (allowedRoles.includes(currentUser?.role) && req.session?.authLevel === 'mfa')
        return next();
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

const requireAdmin = requireRole(STAFF_ROLES);
const requireOwner = requireRole(['owner']);

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

const requireOptionalAuth = async (req, res, next) => {
  if (!req.session?.user) return next();
  try {
    if (await loadCurrentUser(req, res)) return next();
    return res
      .status(401)
      .json({ success: false, error: 'La sesión expiró. Inicia sesión de nuevo.' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  setUserLocals,
  requireAdmin,
  requireOwner,
  requireAuth,
  redirectIfAuthenticated,
  requireAdminMfaPreauth,
  requireOptionalAuth,
};

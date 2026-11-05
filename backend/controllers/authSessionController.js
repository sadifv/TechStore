const logger = require('../config/logger');

const logoutUser = (req, res, next) => {
  if (!req.session) {
    return res.status(200).json({ success: true, message: 'No había una sesión activa.' });
  }

  req.session.destroy((err) => {
    if (err) {
      logger.error(`Error al destruir sesión: ${err.message}`, { stack: err.stack });
      return next(err);
    }

    res.clearCookie('connect.sid', { path: '/' });
    logger.info('Sesión cerrada correctamente.');

    return res.status(200).json({ success: true, message: 'Sesión cerrada correctamente.' });
  });
};

// GET ME
const getMe = (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, error: 'No autenticado.' });
  }
  res.status(200).json({ success: true, user: req.session.user });
};

module.exports = { logoutUser, getMe };

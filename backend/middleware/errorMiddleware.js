const logger = require('../config/logger');
const { getFrontendBaseUrl } = require('../config/frontendUrl');
const getSafeRequestTarget = require('./safeRequestTarget');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.type === 'entity.parse.failed' ? 'El cuerpo JSON no es válido.' : err.message;

  const statusCode = err.statusCode || err.status || 500;
  // Parser/Mongoose/provider messages and stack headings may contain submitted
  // passwords or connection credentials. Log classification, never raw payloads.
  const logMessage = `Error de solicitud - URL: ${getSafeRequestTarget(req)} - Method: ${req.method}`;
  const logMetadata = { errorName: err.name, code: err.code, type: err.type, statusCode };
  if (statusCode >= 500) {
    logger.error(logMessage, logMetadata);
  } else {
    logger.warn(logMessage, logMetadata);
  }

  // ✅ FIX: Manejar específicamente el error de "next is not a function"
  if (err.message && err.message.includes('next is not a function')) {
    error.message = 'Error de ejecución en el flujo de middlewares del servidor.';
  }

  // Error de clave duplicada (MongoDB)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'campo';
    const message = `El valor ingresado para el campo '${field}' ya está registrado.`;
    return res.status(409).json({ success: false, error: message });
  }

  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Los datos enviados no son válidos. Revisa los campos e inténtalo de nuevo.',
    });
  }

  // CastError (ID inválido)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, error: 'Recurso no encontrado. ID inválido.' });
  }

  // Si es navegación web y error 500 → renderizar vista
  if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api') && statusCode === 500) {
    const frontendUrl = getFrontendBaseUrl();
    if (frontendUrl) return res.redirect(302, `${frontendUrl}/error`);
  }

  return res.status(statusCode).json({
    success: false,
    error:
      statusCode >= 500
        ? 'Error interno del servidor.'
        : error.message || 'Error interno del servidor.',
  });
};

module.exports = errorHandler;

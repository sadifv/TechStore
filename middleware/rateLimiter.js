// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const logger = require('../config/logger');

// Helper: detectar si la petición es API/JSON
const isApiRequest = (req) =>
  req.xhr ||
  req.path.startsWith('/api') ||
  req.headers.accept?.includes('json') ||
  req.headers['content-type']?.includes('json');

/**
 * Limitador estricto para el login.
 * 5 intentos cada 10 minutos.
 */
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Demasiados intentos de inicio de sesión. Por favor, inténtalo de nuevo en 10 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit excedido en login desde IP: ${req.ip}`);
    if (isApiRequest(req)) {
      return res.status(options.statusCode).json(options.message);
    }
    return res.status(options.statusCode).send(options.message.error);
  }
});

/**
 * Limitador general para rutas de admin.
 * 100 peticiones cada 15 minutos.
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit excedido en /admin desde IP: ${req.ip} - Ruta: ${req.originalUrl}`);
    if (isApiRequest(req)) {
      return res.status(options.statusCode).json(options.message);
    }
    return res.status(options.statusCode).send(options.message.error);
  }
});

/**
 * Limitador específico para el asistente de IA.
 * 20 peticiones cada 15 minutos.
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Has alcanzado el límite de consultas al asistente. Por favor, espera unos minutos antes de continuar.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit excedido en /api/ai/chat desde IP: ${req.ip}`);
    if (isApiRequest(req)) {
      return res.status(options.statusCode).json(options.message);
    }
    return res.status(options.statusCode).send(options.message.error);
  }
});

/**
 * Ralentiza progresivamente las peticiones a la IA.
 */
const aiSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 10,
  delayMs: (hits) => (hits - 10) * 500,
  maxDelayMs: 5000
});

/**
 * Limitador para el registro.
 * 10 registros cada 60 minutos.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Se han realizado demasiados registros desde esta IP. Inténtalo de nuevo en una hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit excedido en /api/auth/register desde IP: ${req.ip}`);
    if (isApiRequest(req)) {
      return res.status(options.statusCode).json(options.message);
    }
    return res.status(options.statusCode).send(options.message.error);
  }
});

/**
 * Limitador para rutas sensibles.
 * 10 peticiones cada 15 minutos.
 */
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Inténtalo de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit excedido en ruta sensible desde IP: ${req.ip} - Ruta: ${req.originalUrl}`);
    if (isApiRequest(req)) {
      return res.status(options.statusCode).json(options.message);
    }
    return res.status(options.statusCode).send(options.message.error);
  }
});

module.exports = {
  loginLimiter,
  adminLimiter,
  aiLimiter,
  aiSlowDown,
  registerLimiter,
  sensitiveLimiter
};
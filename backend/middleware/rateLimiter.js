// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const logger = require('../config/logger');
const isApiRequest = require('./isApiRequest');
const getSafeRequestTarget = require('./safeRequestTarget');

/**
 * Limitador estricto para el login.
 * 5 intentos cada 10 minutos.
 */
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiados intentos de inicio de sesión. Por favor, inténtalo de nuevo en 10 minutos.',
  },
  handler: (req, res, next) => {
    logger.warn(`Rate limit excedido en login desde IP: ${req.ip}`);
    if (isApiRequest(req)) {
      return res.status(429).json({
        success: false,
        error:
          'Demasiados intentos de inicio de sesión. Por favor, inténtalo de nuevo en 10 minutos.',
      });
    }
    return res
      .status(429)
      .send(
        'Demasiados intentos de inicio de sesión. Por favor, inténtalo de nuevo en 10 minutos.',
      );
  },
});

/**
 * Limitador general para rutas de admin.
 * 100 peticiones cada 15 minutos.
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.',
  },
  handler: (req, res, next) => {
    logger.warn(
      `Rate limit excedido en /admin desde IP: ${req.ip} - Ruta: ${getSafeRequestTarget(req)}`,
    );
    if (isApiRequest(req)) {
      return res.status(429).json({
        success: false,
        error: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.',
      });
    }
    return res.status(429).send('Demasiadas solicitudes. Inténtalo de nuevo más tarde.');
  },
});

/**
 * Limitador específico para el asistente de IA.
 * 20 peticiones cada 15 minutos.
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    logger.warn(`Rate limit excedido en /api/ai/chat desde IP: ${req.ip}`);
    if (isApiRequest(req)) {
      return res.status(429).json({
        success: false,
        error:
          'Has alcanzado el límite de consultas al asistente. Por favor, espera unos minutos antes de continuar.',
      });
    }
    return res
      .status(429)
      .send(
        'Has alcanzado el límite de consultas al asistente. Por favor, espera unos minutos antes de continuar.',
      );
  },
});

/**
 * Ralentiza progresivamente las peticiones a la IA.
 */
const aiSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 10,
  delayMs: (hits) => (hits - 10) * 500,
  maxDelayMs: 5000,
});

/**
 * Limitador para el registro.
 * 10 registros cada 60 minutos.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    logger.warn(`Rate limit excedido en /api/auth/register desde IP: ${req.ip}`);
    if (isApiRequest(req)) {
      return res.status(429).json({
        success: false,
        error:
          'Se han realizado demasiados registros desde esta IP. Inténtalo de nuevo en una hora.',
      });
    }
    return res
      .status(429)
      .send('Se han realizado demasiados registros desde esta IP. Inténtalo de nuevo en una hora.');
  },
});

/**
 * Limitador para rutas sensibles.
 * 10 peticiones cada 15 minutos.
 */
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    logger.warn(
      `Rate limit excedido en ruta sensible desde IP: ${req.ip} - Ruta: ${getSafeRequestTarget(req)}`,
    );
    if (isApiRequest(req)) {
      return res.status(429).json({
        success: false,
        error: 'Demasiadas solicitudes. Inténtalo de nuevo en 15 minutos.',
      });
    }
    return res.status(429).send('Demasiadas solicitudes. Inténtalo de nuevo en 15 minutos.');
  },
});

module.exports = {
  loginLimiter,
  adminLimiter,
  aiLimiter,
  aiSlowDown,
  registerLimiter,
  sensitiveLimiter,
};

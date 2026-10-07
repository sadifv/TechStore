// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

/**
 * Limitador estricto para el login de administrador.
 * Evita ataques de fuerza bruta: 5 intentos cada 10 minutos por IP.
 */
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 5, // 5 intentos por IP
  message: {
    success: false,
    error: 'Demasiados intentos de inicio de sesión. Por favor, inténtalo de nuevo en 10 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit excedido en /admin/login desde IP: ${req.ip}`);
    res.status(options.statusCode).send(options.message);
  }
});

/**
 * Limitador general para rutas de admin (capa extra, más suave).
 * 100 peticiones cada 15 minutos.
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit excedido en /admin desde IP: ${req.ip} - Ruta: ${req.originalUrl}`);
    res.status(options.statusCode).send(options.message);
  }
});

module.exports = {
  loginLimiter,
  adminLimiter
};
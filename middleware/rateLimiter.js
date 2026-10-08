// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
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
    logger.warn(`Rate limit excedido en login desde IP: ${req.ip}`);
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

/**
 * Limitador específico para el asistente de IA.
 * Protege la cuota gratuita de Gemini contra abuso.
 * 20 peticiones cada 15 minutos por IP.
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 peticiones por IP
  message: {
    success: false,
    error: 'Has alcanzado el límite de consultas al asistente. Por favor, espera unos minutos antes de continuar.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit excedido en /api/ai/chat desde IP: ${req.ip}`);
    res.status(options.statusCode).send(options.message);
  }
});

/**
 * Ralentiza progresivamente las peticiones a la IA antes de bloquearlas.
 * A partir de la petición 10, cada una tarda 500ms más.
 * Máximo 5 segundos de delay acumulado.
 */
const aiSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutos
  delayAfter: 10, // Después de 10 peticiones empieza a ralentizar
  delayMs: (hits) => (hits - 10) * 500, // +500ms por cada petición extra
  maxDelayMs: 5000 // Máximo 5 segundos de delay
});

/**
 * Limitador para el registro de usuarios.
 * Evita creación masiva de cuentas desde una misma IP.
 * 10 registros cada 60 minutos.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutos
  max: 10, // 10 registros por IP
  message: {
    success: false,
    error: 'Se han realizado demasiados registros desde esta IP. Inténtalo de nuevo en una hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit excedido en /api/auth/register desde IP: ${req.ip}`);
    res.status(options.statusCode).send(options.message);
  }
});

module.exports = {
  loginLimiter,
  adminLimiter,
  aiLimiter,
  aiSlowDown,
  registerLimiter
};
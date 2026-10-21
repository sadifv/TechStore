// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const logger = require('../config/logger');
const isApiRequest = require('./isApiRequest');
const getSafeRequestTarget = require('./safeRequestTarget');
const { MongoRateLimitStore } = require('./mongoRateLimitStore');
const loginRateLimitConfig = Object.freeze({ windowMs: 10 * 60 * 1000, max: 5 });
const checkoutRateLimitConfig = Object.freeze({ windowMs: 15 * 60 * 1000, max: 10 });
const adminMfaRateLimitConfig = Object.freeze({ windowMs: 10 * 60 * 1000, max: 5 });

/**
 * Limitador estricto para el login.
 * 5 intentos cada 10 minutos.
 */
const loginRateLimitStore = new MongoRateLimitStore('login');
const loginLimiter = rateLimit({
  ...loginRateLimitConfig,
  passOnStoreError: false,
  store: loginRateLimitStore,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiados intentos de inicio de sesión. Por favor, inténtalo de nuevo en 10 minutos.',
  },
  handler: (req, res, next) => {
    logger.warn('Límite de solicitudes excedido en login.');
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
    logger.warn(`Límite de solicitudes excedido en /admin - Ruta: ${getSafeRequestTarget(req)}.`);
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
    logger.warn('Límite de solicitudes excedido en el asistente.');
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
    logger.warn('Límite de solicitudes excedido en registro.');
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

/** Crea un cupo persistente por IP y operación, compartido entre instancias. */
const createSensitiveLimiter = (bucket, { windowMs = 15 * 60 * 1000, max = 10, store } = {}) =>
  rateLimit({
    windowMs,
    max,
    passOnStoreError: false,
    standardHeaders: true,
    legacyHeaders: false,
    store: store || new MongoRateLimitStore(bucket),
    handler: (req, res) => {
      const errorMessage = `Demasiadas solicitudes. Inténtalo de nuevo en ${Math.ceil(windowMs / 60_000)} minutos.`;
      logger.warn(
        `Límite de solicitudes excedido en ruta sensible - Ruta: ${getSafeRequestTarget(req)}.`,
      );
      if (isApiRequest(req)) {
        return res.status(429).json({
          success: false,
          error: errorMessage,
        });
      }
      return res.status(429).send(errorMessage);
    },
  });

const checkoutRateLimitStore = new MongoRateLimitStore('checkout');
const checkoutLimiter = createSensitiveLimiter('checkout', {
  ...checkoutRateLimitConfig,
  store: checkoutRateLimitStore,
});
const adminMfaRateLimitStore = new MongoRateLimitStore('admin-mfa');
const adminMfaLimiter = createSensitiveLimiter('admin-mfa', {
  ...adminMfaRateLimitConfig,
  store: adminMfaRateLimitStore,
});
const contactLimiter = createSensitiveLimiter('contact');
const newsletterLimiter = createSensitiveLimiter('newsletter');
const passwordRecoveryLimiter = createSensitiveLimiter('password-recovery');
const passwordResetLimiter = createSensitiveLimiter('password-reset');

module.exports = {
  loginLimiter,
  adminLimiter,
  aiLimiter,
  aiSlowDown,
  registerLimiter,
  checkoutLimiter,
  adminMfaLimiter,
  // Exposed for deterministic verification of the configured distributed buckets.
  rateLimitStores: {
    login: loginRateLimitStore,
    checkout: checkoutRateLimitStore,
    adminMfa: adminMfaRateLimitStore,
  },
  rateLimitConfig: {
    login: loginRateLimitConfig,
    checkout: checkoutRateLimitConfig,
    adminMfa: adminMfaRateLimitConfig,
  },
  contactLimiter,
  newsletterLimiter,
  passwordRecoveryLimiter,
  passwordResetLimiter,
};

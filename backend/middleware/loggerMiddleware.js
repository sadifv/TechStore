// middleware/loggerMiddleware.js
const logger = require('../config/logger');

const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  // Cuando la respuesta termina, calculamos el tiempo y logueamos
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;
    
    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.http(message);
    }
  });

  next();
};

module.exports = httpLogger;
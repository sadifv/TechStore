const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoDnsServers = (process.env.MONGO_DNS_SERVERS || '')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);

if (mongoDnsServers.length > 0) {
  require('node:dns').setServers(mongoDnsServers);
}

const MongoStore = require('connect-mongo');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { getBackendBaseUrl } = require('./config/backendUrl');
const errorHandler = require('./middleware/errorMiddleware');
const logger = require('./config/logger');
const httpLogger = require('./middleware/loggerMiddleware');
const { createCsrfProtection } = require('./middleware/csrfProtection');
const { adminLimiter } = require('./middleware/rateLimiter');
const { scheduleMaintenanceJobs } = require('./services/maintenanceJobs');

const app = express();

// Solo confiar en los saltos de proxy declarados por el entorno de despliegue.
const trustProxyHops =
  process.env.TRUST_PROXY_HOPS === undefined ? 0 : Number(process.env.TRUST_PROXY_HOPS);
app.set(
  'trust proxy',
  Number.isInteger(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : false,
);

// 3. Middlewares de Seguridad y Logging
app.use(httpLogger);

// Configuración de Helmet con CSP adaptada para desarrollo y producción
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// Habilitar CORS (Permisivo en desarrollo local, estricto en producción)
const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = configuredOrigins.length
  ? configuredOrigins
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      const corsError = new Error('No permitido por CORS');
      corsError.statusCode = 403;
      return callback(corsError);
    },
    credentials: true,
  }),
);

// Defense in depth for browser-originated state changes. CORS controls
// response visibility; this guard also rejects cross-site form submissions.
app.use(createCsrfProtection(allowedOrigins));

// Endpoint de salud para comprobar que Express y MongoDB pueden atender tráfico.
app.get('/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  return res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'unavailable',
  });
});

// Limitador de tasa de peticiones para la API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Demasiadas solicitudes desde esta IP, inténtalo de nuevo en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// 4. Middlewares para parsear datos
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '32kb', parameterLimit: 100 }));

// 5. Configuración de Sesiones Persistentes en MongoDB
const storeOptions = {
  mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/techstore',
  collectionName: 'sessions',
};

const sessionStore =
  typeof MongoStore.create === 'function'
    ? MongoStore.create(storeOptions)
    : MongoStore.default && typeof MongoStore.default.create === 'function'
      ? MongoStore.default.create(storeOptions)
      : new MongoStore(storeOptions);

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secreto_techstore',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

// Las imágenes que sube el administrador se guardan en MongoDB.
app.get('/uploads/products/:imageId', require('./controllers/productImageController').serveProductImage);

// 8. Middleware global para res.locals.user
const { setUserLocals } = require('./middleware/authMiddleware');
app.use(setUserLocals);

// 9. Definición de Rutas
app.use('/', require('./routes/indexRoutes'));
app.use('/api', require('./routes/apiRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));

app.use('/admin', adminLimiter);
app.use('/admin', require('./routes/adminRoutes'));

// 10. Manejo de Rutas No Encontradas (404)
app.use((req, res) => {
  if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
    const { redirectToFrontend } = require('./config/frontendUrl');
    return redirectToFrontend(req, res);
  }
  res.status(404).json({
    success: false,
    error: 'Recurso no encontrado.',
  });
});

// 11. Manejo de errores
app.use(errorHandler);

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception; proceso terminado.', {
    errorCode: error.code || error.name,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection.', {
    errorCode: reason instanceof Error ? reason.code || reason.name : 'NonErrorRejection',
  });
});

if (require.main === module) {
  const startupErrors = [];
  if (!['development', 'production'].includes(process.env.NODE_ENV)) {
    startupErrors.push('Define NODE_ENV como development o production.');
  }
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.MONGO_URI) {
      startupErrors.push('MONGO_URI es obligatorio en producción.');
    }
    try {
      require('./config/whatsapp').getWhatsappPhone();
    } catch (error) {
      startupErrors.push(error.message);
    }
    if (Buffer.byteLength(process.env.SESSION_SECRET || '', 'utf8') < 32) {
      startupErrors.push('SESSION_SECRET debe contener al menos 32 bytes en producción.');
    }
    if (
      !process.env.ALLOWED_ORIGINS ||
      !allowedOrigins.length ||
      allowedOrigins.some((origin) => !origin.startsWith('https://'))
    ) {
      startupErrors.push('ALLOWED_ORIGINS debe contener los orígenes HTTPS públicos exactos.');
    }
    if (!Number.isInteger(trustProxyHops) || trustProxyHops < 1) {
      startupErrors.push('Configura TRUST_PROXY_HOPS con el número exacto de proxies confiables.');
    }
    try {
      getBackendBaseUrl();
    } catch (error) {
      startupErrors.push(error.message);
    }
    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || '';
    if (!frontendUrl.startsWith('https://')) {
      startupErrors.push('FRONTEND_URL o APP_URL debe usar HTTPS en producción.');
    }
  }
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
    startupErrors.push('TRUST_PROXY_HOPS debe ser un entero no negativo.');
  }
  if (startupErrors.length) {
    startupErrors.forEach((message) => logger.error(message));
    process.exit(1);
  }

  const start = async () => {
    await connectDB();
    await require('./models/Order').init();
    await require('./services/campaignQueue').startCampaignQueue();
    scheduleMaintenanceJobs();

    const PORT = process.env.PORT || 3001;
    const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
    app.listen(PORT, HOST, () => {
      logger.info(`Servidor ejecutándose en http://${HOST}:${PORT}`);
    });
  };

  start().catch((error) => {
    logger.error('No se pudo iniciar el servidor.', {
      errorCode: error.code || error.name,
    });
    process.exit(1);
  });
}

module.exports = app;

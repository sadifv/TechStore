const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const MongoStore = require('connect-mongo');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorMiddleware');
const logger = require('./config/logger');
const httpLogger = require('./middleware/loggerMiddleware');
const { adminLimiter } = require('./middleware/rateLimiter');
const Product = require('./models/Product');

const app = express();

// 1. Conectar a MongoDB
connectDB();

// CRON JOB: Restaurar flash sales expiradas cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
    const now = new Date();
    try {
        const expiredSales = await Product.find({
            flashSale: true,
            flashSaleEndsAt: { $lt: now }
        });

        for (const product of expiredSales) {
            if (product.originalPrice !== null && product.originalPrice !== undefined) {
                product.price = product.originalPrice;
            }
            product.flashSale = false;
            product.flashSaleDiscount = 0;
            product.flashSaleEndsAt = null;
            product.originalPrice = null;
            await product.save();

            logger.info(`Flash sale expirada restaurada (cron): ${product.name} (ID: ${product._id})`);
        }
    } catch (cronError) {
        logger.error(`Error en cron job flash sale restore: ${cronError.message}`, { stack: cronError.stack });
    }
});

// CRON JOB: Limpiar reservas expiradas cada 10 minutos
cron.schedule('*/10 * * * *', async () => {
    try {
        const Reservation = require('./models/Reservation');
        const cleaned = await Reservation.cleanupExpired();
        if (cleaned > 0) {
            logger.info(`Reservas expiradas limpiadas (cron): ${cleaned}`);
        }
    } catch (cronError) {
        logger.error(`Error en cron job reservation cleanup: ${cronError.message}`, { stack: cronError.stack });
    }
});

// Reintentar la conciliación de inventario de sesiones Stripe expiradas cada 10 minutos.
cron.schedule('*/10 * * * *', async () => {
    try {
        const {
            reconcileExpiredOrders,
            pruneCompletedInventoryRestorationKeys
        } = require('./controllers/orderController');
        const reconciledOrders = await reconcileExpiredOrders();
        if (reconciledOrders > 0) {
            logger.info(`Órdenes de Stripe vencidas reconciliadas: ${reconciledOrders}`);
        }
        const prunedOrders = await pruneCompletedInventoryRestorationKeys();
        if (prunedOrders > 0) {
            logger.info(`Claves de restitución de inventario limpiadas: ${prunedOrders}`);
        }
    } catch (cronError) {
        logger.error(`Error en cron job de conciliación de checkout: ${cronError.message}`, { stack: cronError.stack });
    }
});

// Expirar membresías cuyo período terminó; una renovación Stripe confirmada las mantiene activas.
cron.schedule('15 0 * * *', async () => {
    try {
        const Membership = require('./models/Membership');
        const result = await Membership.updateMany(
            { status: 'active', currentPeriodEnd: { $lte: new Date() } },
            { $set: { status: 'expired' } }
        );
        if (result.modifiedCount > 0) {
            logger.info(`Membresías VIP expiradas: ${result.modifiedCount}`);
        }
    } catch (cronError) {
        logger.error(`Error al expirar membresías VIP: ${cronError.message}`, { stack: cronError.stack });
    }
});

// 2. Confiar en el proxy (IMPORTANTE para producción / Nginx / Render)
app.set('trust proxy', 1); 

// 3. Middlewares de Seguridad y Logging
app.use(httpLogger);

// Configuración de Helmet con CSP adaptada para desarrollo y producción
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        styleSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// Habilitar CORS (Permisivo en desarrollo local, estricto en producción)
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    const corsError = new Error('No permitido por CORS');
    corsError.statusCode = 403;
    return callback(corsError);
  },
  credentials: true
}));

// Limitador de tasa de peticiones para la API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Demasiadas solicitudes desde esta IP, inténtalo de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// 4. Middlewares para parsear datos
app.use('/api/orders/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Configuración de Sesiones Persistentes en MongoDB
const storeOptions = {
  mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/techstore',
  collectionName: 'sessions'
};

const sessionStore = typeof MongoStore.create === 'function'
  ? MongoStore.create(storeOptions)
  : (MongoStore.default && typeof MongoStore.default.create === 'function')
    ? MongoStore.default.create(storeOptions)
    : new MongoStore(storeOptions);

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  logger.error('SESSION_SECRET no está definido en producción. El servidor no puede iniciar.');
  process.exit(1);
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_techstore',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// El frontend vive en la aplicación React. Express solo sirve imágenes
// dinámicas que el administrador sube al backend.
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

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
    error: 'Recurso no encontrado.'
  });
});

// 11. Manejo de errores
app.use(errorHandler);

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    logger.info(`Servidor ejecutándose en http://localhost:${PORT}`);
  });
}

module.exports = app;

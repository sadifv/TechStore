require('dotenv').config();
const MongoStore = require('connect-mongo');
const express = require('express');
const path = require('path');
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

// 2. Confiar en el proxy (IMPORTANTE para producción / Nginx / Render)
app.set('trust proxy', 1); 

// 3. Middlewares de Seguridad y Logging
app.use(httpLogger);

// Configuración de Helmet con CSP estricta
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
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

// Habilitar CORS (restringido a orígenes permitidos)
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
  : ['http://localhost:3001', 'http://127.0.0.1:3001'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('No permitido por CORS'));
  },
  credentials: true
}));

// Limitador de tasa de peticiones para la API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
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
// IMPORTANTE: El webhook de Stripe necesita el cuerpo en formato raw (Buffer)
app.use('/api/orders/webhook', express.raw({ type: 'application/json' }), (req, res, next) => next());

// Parsers globales para el resto de rutas
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

// Validar secreto de sesión en producción
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
    sameSite: 'lax', // Conserva la sesión tras la redirección de Stripe
    maxAge: 1000 * 60 * 60 * 24 // 24 horas
  }
}));

// 6. Configuración del motor de plantillas EJS + Layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);
app.set('layout extractMetas', true);

// 7. Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// 8. Middleware global para res.locals.user
const { setUserLocals } = require('./middleware/authMiddleware');
app.use(setUserLocals);

// 9. Definición de Rutas
app.use('/', require('./routes/indexRoutes'));
app.use('/api', require('./routes/apiRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));

// Aplicar adminLimiter global a todo /admin
app.use('/admin', adminLimiter);
app.use('/admin', require('./routes/adminRoutes'));

// 10. Manejo de Rutas No Encontradas (404)
app.use((req, res) => {
  if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api')) {
    return res.status(404).render('404', {
      title: 'Página no encontrada | TechStore',
      message: 'La página que estás buscando no existe o ha sido movida.'
    });
  }
  res.status(404).json({
    success: false,
    error: 'Recurso no encontrado.'
  });
});

// 11. Middleware global para manejo de errores (500)
app.use(errorHandler);

// 12. Manejo de excepciones no capturadas
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 13. Inicialización del servidor HTTP solo si no se requiere como módulo de prueba
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    logger.info(`Servidor ejecutándose en http://localhost:${PORT}`);
  });
}

module.exports = app;
require('dotenv').config();
const MongoStore = require('connect-mongo');
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorMiddleware');
const logger = require('./config/logger'); 
const httpLogger = require('./middleware/loggerMiddleware'); 

const app = express();

// 1. Conectar a MongoDB
connectDB();

// 2. Middlewares de Seguridad y Logging
app.use(httpLogger); // <-- NUEVO: Reemplaza a morgan

// Configuración de Helmet (desactivamos CSP para permitir iconos de RemixIcon y CDNs)
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

// Habilitar CORS
app.use(cors());

// Limitador de tasa de peticiones para la API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: {
    success: false,
    error: 'Demasiadas solicitudes desde esta IP, inténtalo de nuevo en 15 minutos.'
  }
});
app.use('/api', apiLimiter);

// 3. Middlewares para parsear datos
// IMPORTANTE: El webhook de Stripe necesita el cuerpo en formato raw (Buffer) ANTES que express.json()
app.use('/api/orders/webhook', express.raw({ type: 'application/json' }));

// Resto de parsers globales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Configuración de Sesiones Persistentes en MongoDB (connect-mongo)
const storeOptions = {
  mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/techstore',
  collectionName: 'sessions'
};

const sessionStore = typeof MongoStore.create === 'function'
  ? MongoStore.create(storeOptions)
  : (MongoStore.default && typeof MongoStore.default.create === 'function')
    ? MongoStore.default.create(storeOptions)
    : new MongoStore(storeOptions);

app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_techstore',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Conserva la sesión al ser redirigido desde Stripe
    maxAge: 1000 * 60 * 60 * 24 // 24 horas
  }
}));

// 5. Configuración del motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 6. Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// 7. Middleware global para res.locals.user
const { setUserLocals } = require('./middleware/authMiddleware');
app.use(setUserLocals);

// 8. Definición de Rutas
app.use('/', require('./routes/indexRoutes'));
app.use('/api', require('./routes/apiRoutes'));
app.use('/api/cart', require('./routes/cartRoutes')); 
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

// 9. Middleware global para manejo de errores
app.use(errorHandler);

// 10. Manejo de errores no capturados (NUEVO)
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    logger.info(`Servidor ejecutándose en http://localhost:${PORT}`); // <-- Cambiado a logger.info
});
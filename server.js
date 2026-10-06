require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();

// 1. Conectar a MongoDB
connectDB();

// 2. Middlewares de Seguridad y Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Configuración de Sesiones con Cookies Seguras y CSRF nativo
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_techstore',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true solo en producción (HTTPS)
    sameSite: 'strict', // Protección CSRF nativa
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
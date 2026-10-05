require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

// 1. Conectar a MongoDB
connectDB();

// 2. Middlewares para parsear datos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Configuración del motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 4. Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// 5. Middleware global para res.locals.user (preparado para navbar.ejs)
const { setUserLocals } = require('./middleware/authMiddleware');
app.use(setUserLocals);

// 6. Definición de Rutas
app.use('/', require('./routes/indexRoutes'));
app.use('/api', require('./routes/apiRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../config/logger');

const seedAdmin = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/techstore';
    await mongoose.connect(mongoURI);
    logger.info('Conectado a MongoDB para ejecutar seedAdmin...');

    const adminEmail = 'admin@techstore.com';
    const rawPassword = 'admin123password';

    // Verificar si el usuario admin ya existe
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      logger.info('El usuario administrador ya existe en la base de datos.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Pasamos la contraseña en texto plano: el hook pre('save') de User.js la encriptará
    const adminUser = new User({
      name: 'Admin Sadi',
      email: adminEmail,
      password: rawPassword,
      role: 'admin'
    });

    await adminUser.save();

    logger.info('¡Usuario Administrador creado con éxito!');
    logger.info(`Email: ${adminEmail}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error(`Error al crear el usuario administrador: ${error.message}`, { stack: error.stack });
    process.exit(1);
  }
};

seedAdmin();
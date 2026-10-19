const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // 10s para seleccionar servidor
      socketTimeoutMS: 45000, // 45s para operaciones
      maxPoolSize: 10, // Máximo 10 conexiones
      minPoolSize: 2, // Mínimo 2 conexiones
      retryWrites: true,
    });

    logger.info(`MongoDB Conectado: ${conn.connection.host}`);

    // Eventos de conexión
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB desconectado. Intentando reconectar...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconectado exitosamente.');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Error de conexión MongoDB.', { errorCode: err.code || err.name });
    });
  } catch (error) {
    logger.error('Error de conexión a MongoDB.', { errorCode: error.code || error.name });
    process.exit(1);
  }
};

module.exports = connectDB;

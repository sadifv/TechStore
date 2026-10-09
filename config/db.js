const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        logger.info(`MongoDB Conectado: ${conn.connection.host}`);
    } catch (error) {
        logger.error(`Error de conexión a MongoDB: ${error.message}`, { stack: error.stack });
        process.exit(1);
    }
};

module.exports = connectDB;
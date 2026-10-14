const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    const statusCode = err.statusCode || err.status || 500;
    const logMessage = `${err.message} - URL: ${req.originalUrl} - Method: ${req.method}`;
    const logMetadata = { stack: err.stack, code: err.code };
    if (statusCode >= 500) {
        logger.error(logMessage, logMetadata);
    } else {
        logger.warn(logMessage, logMetadata);
    }

    // ✅ FIX: Manejar específicamente el error de "next is not a function"
    if (err.message && err.message.includes('next is not a function')) {
        error.message = 'Error de ejecución en el flujo de middlewares del servidor.';
    }

    // Error de clave duplicada (MongoDB)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'campo';
        const message = `El valor ingresado para el campo '${field}' ya está registrado.`;
        return res.status(409).json({ success: false, error: message });
    }

    // Error de validación de Mongoose
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        return res.status(400).json({ success: false, error: message });
    }

    // CastError (ID inválido)
    if (err.name === 'CastError') {
        return res.status(400).json({ success: false, error: 'Recurso no encontrado. ID inválido.' });
    }

    // Si es navegación web y error 500 → renderizar vista
    if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api') && statusCode === 500) {
        return res.status(500).render('500', {
            title: 'Error Servidor | TechStore',
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    }

    return res.status(statusCode).json({
        success: false,
        error: error.message || 'Error interno del servidor.'
    });
};

module.exports = errorHandler;
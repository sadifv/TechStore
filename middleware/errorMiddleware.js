const logger = require('../config/logger'); 

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Loguear el error con contexto (URL, método y stack trace)
    logger.error(`${err.message} - URL: ${req.originalUrl} - Method: ${req.method}`, {
        stack: err.stack,
        code: err.code
    });

    // Error de clave duplicada en MongoDB (ej. email registrado) -> 409 Conflict
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'campo';
        const message = `El valor ingresado para el campo '${field}' ya está registrado.`;
        return res.status(409).json({ success: false, error: message });
    }

    // Error de validación de esquema en Mongoose (ej. price < 0)
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        return res.status(400).json({ success: false, error: message });
    }

    // Error de ID inválido (CastError)
    if (err.name === 'CastError') {
        return res.status(400).json({ success: false, error: 'Recurso no encontrado. ID inválido.' });
    }

    res.status(err.statusCode || 500).json({
        success: false,
        error: error.message || 'Error interno del servidor.'
    });
};

module.exports = errorHandler;
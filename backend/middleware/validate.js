// middleware/validate.js
const logger = require('../config/logger');
const getSafeRequestTarget = require('./safeRequestTarget');

/**
 * Validación simple basada en reglas (sin dependencias externas).
 */

const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

// ==========================================
// REGLAS DE VALIDACIÓN POR RUTA
// ==========================================
const productValidationRules = {
    name: { required: true, min: 2, max: 100, label: 'El nombre del producto' },
    price: { required: true, number: true, gt: 0, label: 'El precio' },
    stock: { required: true, integer: true, gt: -1, label: 'El stock' },
    category: { required: true, label: 'La categoría' }
};

const validationRules = {
    '/api/auth/register': {
        name: { required: true, min: 2, max: 80, label: 'El nombre' },
        email: { required: true, email: true, label: 'El correo' },
        password: { required: true, min: 12, max: 100, label: 'La contraseña' }
    },
    '/api/auth/login': {
        email: { required: true, email: true, label: 'El correo' },
        password: { required: true, label: 'La contraseña' }
    },
    '/api/contact': {
        name: { required: true, min: 2, max: 80, label: 'El nombre' },
        email: { required: true, email: true, label: 'El correo' },
        message: { required: true, min: 10, max: 1000, label: 'El mensaje' }
    },
    '/api/newsletter': {
        email: { required: true, email: true, label: 'El correo' }
    },
    '/api/auth/forgot-password': {
        email: { required: true, email: true, label: 'El correo' }
    },
    '/api/auth/reset-password/:token': {
        password: { required: true, min: 12, max: 100, label: 'La contraseña' }
    },
    '/admin/products': productValidationRules,
    '/admin/products/:id': productValidationRules
};

// ==========================================
// HELPERS
// ==========================================
const cleanUrl = (url) => {
    if (!url) return '/';
    return url.split('?')[0].replace(/\/$/, '') || '/';
};

const findRules = (url) => {
    const clean = cleanUrl(url);

    if (validationRules[clean]) {
        return validationRules[clean];
    }

    for (const [pattern, rules] of Object.entries(validationRules)) {
        if (!pattern.includes(':')) continue;

        const regexPattern = pattern.replace(/:[^/]+/g, '[^/]+');
        const regex = new RegExp(`^${regexPattern}$`);

        if (regex.test(clean)) {
            return rules;
        }
    }

    return null;
};

// ==========================================
// MIDDLEWARE PRINCIPAL
// ==========================================
const validate = (req, res, next) => {
    try {
        const currentUrl = req.originalUrl || req.url;
        const rules = findRules(currentUrl);

        // Si no hay reglas para esta ruta, continuar de forma segura
        if (!rules) {
            return typeof next === 'function' ? next() : res.status(500).json({ success: false, error: 'Error de flujo en servidor' });
        }

        const errors = [];
        const data = req.body || {};

        for (const [field, rule] of Object.entries(rules)) {
            const rawValue = data[field];
            const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
            const isEmpty = value === undefined || value === null || value === '';

            // Requerido
            if (rule.required && isEmpty) {
                errors.push(`${rule.label || field} es obligatorio`);
                continue;
            }

            if (!rule.required && isEmpty) {
                continue;
            }

            // Email
            if (rule.email && !isValidEmail(value)) {
                errors.push(`${rule.label || field} no es un correo válido`);
            }

            // Min length
            if (rule.min !== undefined && String(value).length < rule.min) {
                errors.push(`${rule.label || field} debe tener al menos ${rule.min} caracteres`);
            }

            // Max length
            if (rule.max !== undefined && String(value).length > rule.max) {
                errors.push(`${rule.label || field} no puede superar los ${rule.max} caracteres`);
            }

            // Numérico
            if (rule.number && isNaN(Number(value))) {
                errors.push(`${rule.label || field} debe ser un número`);
            }

            // Mayor que
            if (rule.gt !== undefined && Number(value) <= rule.gt) {
                errors.push(`${rule.label || field} debe ser mayor a ${rule.gt}`);
            }

            // Entero
            if (rule.integer && !Number.isInteger(Number(value))) {
                errors.push(`${rule.label || field} debe ser un número entero`);
            }
        }

        if (errors.length > 0) {
            logger.warn(`Validación fallida en ${req.method} ${getSafeRequestTarget(req)}: ${errors[0]}`);
            
            // ✅ Si la petición es hacia una ruta /api, SIEMPRE responde con JSON
            if (currentUrl.startsWith('/api') || req.path.startsWith('/api')) {
                return res.status(400).json({
                    success: false,
                    error: errors[0],
                    errors: errors.map(msg => ({ message: msg }))
                });
            }

            return res.status(400).json({
                success: false,
                error: errors[0],
                errors: errors.map(msg => ({ message: msg }))
            });
        }

        if (typeof next === 'function') {
            return next();
        }
    } catch (valError) {
        logger.error(`Excepción en middleware validate en ${getSafeRequestTarget(req)}: ${valError.message}`, { stack: valError.stack });
        if (typeof next === 'function') {
            return next(valError);
        }
        return res.status(500).json({ success: false, error: 'Error interno de validación' });
    }
};

module.exports = { validate };

const { validationResult, body } = require('express-validator');

// Middleware generador para verificar los errores de express-validator
const validate = (validations) => {
    return async (req, res, next) => {
        // Ejecutar todas las validaciones definidas
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        // Si la petición viene de una API / Fetch / Axios / JSON
        if (req.xhr || req.headers.accept?.includes('json') || req.path.startsWith('/api')) {
            return res.status(400).json({
                success: false,
                errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
            });
        }

        // Si viene de un formulario HTML EJS convencional
        try {
            const viewName = req.route?.path ? req.route.path.replace(/^\//, '') : 'index';
            return res.status(400).render(viewName, {
                title: 'Error de Validación',
                errors: errors.array(),
                oldInput: req.body
            });
        } catch (renderError) {
            return res.status(400).json({
                success: false,
                errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
            });
        }
    };
};

// Reglas de validación reutilizables
const authValidation = {
    register: [
        body('name').trim().notEmpty().withMessage('El nombre es obligatorio'),
        body('email').isEmail().normalizeEmail().withMessage('Ingresa un correo electrónico válido'),
        body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
    ],
    login: [
        body('email').isEmail().normalizeEmail().withMessage('Correo electrónico no válido'),
        body('password').notEmpty().withMessage('La contraseña no puede estar vacía')
    ]
};

const productValidation = [
    body('name').trim().notEmpty().withMessage('El nombre del producto es obligatorio'),
    body('price').isFloat({ gt: 0 }).withMessage('El precio debe ser un número mayor a 0'),
    body('stock').isInt({ min: 0 }).withMessage('El stock debe ser un número entero mayor o igual a 0'),
    body('category').trim().notEmpty().withMessage('Debes seleccionar una categoría')
];

const contactValidation = [
    body('name').trim().notEmpty().withMessage('El nombre es obligatorio'),
    body('email').isEmail().normalizeEmail().withMessage('Correo electrónico no válido'),
    body('message').trim().isLength({ min: 10 }).withMessage('El mensaje debe tener al menos 10 caracteres')
];

const newsletterValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Ingresa un correo electrónico válido')
];

module.exports = {
    validate,
    authValidation,
    productValidation,
    contactValidation,
    newsletterValidation
};
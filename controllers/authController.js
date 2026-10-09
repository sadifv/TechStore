const User = require('../models/User');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');

// @desc    Registrar un nuevo usuario
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'El correo electrónico ya está registrado.'
            });
        }

        const newUser = new User({ name, email, password, role: 'user' });
        await newUser.save();

        req.session.user = {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
        };

        logger.info(`Nuevo usuario registrado: ${newUser.email}`);

        res.status(201).json({
            success: true,
            message: 'Usuario registrado con éxito.',
            user: req.session.user
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Procesar inicio de sesión
// @route   POST /login o /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'El correo no está registrado. Debes crear una cuenta primero.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Contraseña incorrecta. Inténtalo de nuevo.'
            });
        }

        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        logger.info(`Login exitoso: ${user.email}`);

        res.status(200).json({
            success: true,
            message: 'Inicio de sesión exitoso.',
            user: req.session.user
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Cerrar sesión de usuario
// @route   POST /api/auth/logout o GET /admin/logout
// @access  Private
const logoutUser = (req, res, next) => {
    if (!req.session) {
        return res.status(200).json({
            success: true,
            message: 'No había una sesión activa.'
        });
    }

    const userEmail = req.session.user?.email || 'desconocido';

    req.session.destroy((err) => {
        if (err) {
            logger.error(`Error al destruir sesión: ${err.message}`, { stack: err.stack });
            return next(err);
        }

        res.clearCookie('connect.sid', { path: '/' });
        logger.info(`Logout exitoso: ${userEmail}`);

        if (req.accepts('html') && !req.xhr && !req.headers['x-requested-with']) {
            return res.redirect('/login');
        }

        return res.status(200).json({
            success: true,
            message: 'Sesión cerrada correctamente.'
        });
    });
};

// @desc    Obtener datos del usuario actual
// @route   GET /api/auth/me
// @access  Private
const getMe = (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            error: 'No autenticado.'
        });
    }
    res.status(200).json({
        success: true,
        user: req.session.user
    });
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    getMe
};
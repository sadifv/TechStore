const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../config/mailer');
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

        // Si es petición de formulario HTML, redirigir a la página principal
        if (req.accepts('html') && !req.xhr && !req.headers['x-requested-with']) {
            return res.redirect('/');
        }

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

        // Si es petición de formulario HTML, redirigir a la página principal
        if (req.accepts('html') && !req.xhr && !req.headers['x-requested-with']) {
            return res.redirect('/');
        }

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

// @desc    Solicitar token de recuperación de contraseña
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'No existe una cuenta asociada a este correo electrónico.'
            });
        }

        // Generar token criptográfico y expira en 1 hora
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hora en ms

        await user.save();

        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

        await sendPasswordResetEmail(user.email, resetUrl);

        // Si es petición de formulario HTML, redirigir al login
        if (req.accepts('html') && !req.xhr && !req.headers['x-requested-with']) {
            return res.redirect('/login');
        }

        res.status(200).json({
            success: true,
            message: 'Se ha enviado un correo con las instrucciones de restablecimiento.'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Restablecer contraseña usando el token recibido
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'El token de recuperación es inválido o ha expirado.'
            });
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        // Si es petición de formulario HTML, redirigir al login
        if (req.accepts('html') && !req.xhr && !req.headers['x-requested-with']) {
            return res.redirect('/login');
        }

        res.status(200).json({
            success: true,
            message: 'Contraseña restablecida con éxito. Puedes iniciar sesión con tus nuevas credenciales.'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    getMe,
    forgotPassword,
    resetPassword
};
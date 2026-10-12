const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../config/mailer');
const logger = require('../config/logger');

// ==========================================
// REGISTRO
// ==========================================
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

        // ✅ Enviar email de bienvenida (no bloqueante)
        try {
            const { sendWelcomeEmail } = require('../config/mailer');
            if (typeof sendWelcomeEmail === 'function') {
                await sendWelcomeEmail(newUser.email, newUser.name);
            }
        } catch (emailError) {
            logger.warn(`No se pudo enviar email de bienvenida: ${emailError.message}`);
        }

        if (req.accepts('html') && !req.xhr && !req.headers['x-requested-with']) {
            return res.redirect('/');
        }

        res.status(201).json({
            success: true,
            message: 'Usuario registrado con éxito.',
            user: req.session.user
        });
    } catch (error) {
        // ✅ FIX: Manejar errores de validación de Mongoose
        if (error.name === 'ValidationError') {
            const message = Object.values(error.errors).map(val => val.message).join(' ');
            return res.status(400).json({ success: false, error: message });
        }
        next(error);
    }
};

// ==========================================
// LOGIN
// ==========================================
const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // ✅ FIX: Incluir el password (select: false en el modelo)
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'El correo no está registrado. Debes crear una cuenta primero.'
            });
        }

        // ✅ FIX: Usar el método comparePassword del modelo si existe
        const isMatch = typeof user.comparePassword === 'function'
            ? await user.comparePassword(password)
            : await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Contraseña incorrecta. Inténtalo de nuevo.'
            });
        }

        // ✅ Actualizar lastLoginAt
        user.lastLoginAt = new Date();
        await user.save();

        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        logger.info(`Login exitoso: ${user.email}`);

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

// ==========================================
// LOGOUT
// ==========================================
const logoutUser = (req, res, next) => {
    if (!req.session) {
        return res.status(200).json({ success: true, message: 'No había una sesión activa.' });
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

        return res.status(200).json({ success: true, message: 'Sesión cerrada correctamente.' });
    });
};

// ==========================================
// GET ME
// ==========================================
const getMe = (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, error: 'No autenticado.' });
    }
    res.status(200).json({ success: true, user: req.session.user });
};

// ==========================================
// FORGOT PASSWORD
// ==========================================
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        // ✅ FIX: No revelar si el email existe (evita enumeración)
        if (!user) {
            logger.warn(`Intento de reset para email inexistente: ${email}`);
            return res.status(200).json({
                success: true,
                message: 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.'
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 3600000;

        await user.save();

        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

        await sendPasswordResetEmail(user.email, resetUrl);

        logger.info(`Email de reset enviado a: ${user.email}`);

        if (req.accepts('html') && !req.xhr && !req.headers['x-requested-with']) {
            return res.redirect('/login');
        }

        res.status(200).json({
            success: true,
            message: 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.'
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// RESET PASSWORD
// ==========================================
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

        logger.info(`Contraseña restablecida para: ${user.email}`);

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
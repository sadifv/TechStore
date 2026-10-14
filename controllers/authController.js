const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../config/mailer');
const logger = require('../config/logger');

// ==========================================
// HELPER PARA DETECTAR PETICIONES HTML VS API/JSON
// ==========================================
const isHtmlRequest = (req) => {
    return req.accepts('html') && 
           !req.xhr && 
           !req.headers['x-requested-with'] && 
           !req.is('json') && 
           !req.headers['content-type']?.includes('json');
};

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

        if (isHtmlRequest(req)) {
            return res.redirect('/');
        }

        res.status(201).json({
            success: true,
            message: 'Usuario registrado con éxito.',
            user: req.session.user
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const message = Object.values(error.errors).map(val => val.message).join(' ');
            return res.status(400).json({ success: false, error: message });
        }
        next(error);
    }
};

// ==========================================
// LOGIN (Blindado y compatible con API/JSON y Web)
// ==========================================
const loginUser = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            const message = 'No encontramos una cuenta con ese correo. Puedes crear una cuenta para continuar.';
            if (isHtmlRequest(req)) {
                return res.status(401).render('login', {
                    title: 'TechStore - Iniciar Sesión',
                    error: message,
                    emailValue: email,
                    showRegisterLink: true
                });
            }
            return res.status(401).json({
                success: false,
                code: 'ACCOUNT_NOT_FOUND',
                error: message
            });
        }

        const isMatch = typeof user.comparePassword === 'function'
            ? await user.comparePassword(password)
            : await bcrypt.compare(password, user.password);

        if (!isMatch) {
            const message = 'La contraseña no coincide. Revísala e inténtalo de nuevo.';
            if (isHtmlRequest(req)) {
                return res.status(401).render('login', {
                    title: 'TechStore - Iniciar Sesión',
                    error: message,
                    emailValue: email
                });
            }
            return res.status(401).json({
                success: false,
                code: 'INVALID_PASSWORD',
                error: message
            });
        }

        user.lastLoginAt = new Date();
        await user.save();

        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        logger.info(`Login exitoso: ${user.email}`);

        if (isHtmlRequest(req)) {
            return res.redirect('/');
        }

        return res.status(200).json({
            success: true,
            message: 'Inicio de sesión exitoso.',
            user: req.session.user
        });
    } catch (error) {
        logger.error(`Error en loginUser: ${error.message}`, { stack: error.stack });
        if (isHtmlRequest(req)) {
            return res.status(500).render('login', {
                title: 'TechStore - Iniciar Sesión',
                error: 'Ocurrió un error interno al iniciar sesión. Inténtalo de nuevo.',
                emailValue: String(req.body?.email || '').trim()
            });
        }
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor al iniciar sesión.'
        });
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

        if (isHtmlRequest(req)) {
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

        if (isHtmlRequest(req)) {
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

        if (isHtmlRequest(req)) {
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
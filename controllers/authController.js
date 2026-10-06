const User = require('../models/User');
const bcrypt = require('bcryptjs');

// @desc    Registrar un nuevo usuario
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Por favor, ingresa todos los campos requeridos.'
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'El correo electrónico ya está registrado.'
            });
        }

        const newUser = new User({ name, email, password, role: 'user' });
        await newUser.save();

        // Autenticar al usuario automáticamente en la sesión
        req.session.user = {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
        };

        res.status(201).json({
            success: true,
            message: 'Usuario registrado con éxito.',
            user: req.session.user
        });
    } catch (error) {
        console.error('Error en registerUser:', error);
        res.status(500).json({
            success: false,
            error: 'Error en el servidor al registrar usuario.'
        });
    }
};

// @desc    Procesar inicio de sesión
// @route   POST /admin/login o /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Por favor, ingresa correo y contraseña.'
            });
        }

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

        // Guardar usuario en la sesión de Express
        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        res.status(200).json({
            success: true,
            message: 'Inicio de sesión exitoso.',
            user: req.session.user
        });

    } catch (error) {
        console.error('Error en loginUser:', error);
        res.status(500).json({
            success: false,
            error: 'Error en el servidor al iniciar sesión.'
        });
    }
};

// @desc    Cerrar sesión de usuario
// @route   POST /api/auth/logout o GET /admin/logout
// @access  Private
const logoutUser = (req, res) => {
    if (!req.session) {
        return res.status(200).json({
            success: true,
            message: 'No había una sesión activa.'
        });
    }

    req.session.destroy((err) => {
        if (err) {
            console.error('Error al destruir sesión:', err);
            return res.status(500).json({
                success: false,
                error: 'No se pudo cerrar la sesión.'
            });
        }
        
        // Limpiar cookie de sesión en el navegador
        res.clearCookie('connect.sid', { path: '/' });

        // Si la solicitud es explícitamente navegación HTML directa (e.g., clic en enlace GET)
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
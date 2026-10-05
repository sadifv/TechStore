const User = require('../models/User');
const bcrypt = require('bcryptjs');

// @desc    Procesar inicio de sesión
// @route   POST /api/auth/login
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
                error: 'Credenciales inválidas.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales inválidas.'
            });
        }

        // Guardar usuario en la sesión de Express
        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };
        
        // Aquí puedes gestionar la sesión o JWT según el flujo de la app
        res.status(200).json({
            success: true,
            message: 'Inicio de sesión exitoso.',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Error en loginUser:', error);
        res.status(500).json({
            success: false,
            error: 'Error en el servidor al iniciar sesión.'
        });
    }
};

module.exports = {
    loginUser
};
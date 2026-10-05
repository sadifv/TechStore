const Newsletter = require('../models/Newsletter'); // Asegúrate de crear el modelo

// @desc    Suscribir correo al newsletter
// @route   POST /api/newsletter
// @access  Public
const subscribeNewsletter = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Por favor, proporciona un correo electrónico válido.' 
            });
        }

        // Verificar si ya está suscrito
        const existingSubscriber = await Newsletter.findOne({ email });
        if (existingSubscriber) {
            return res.status(400).json({ 
                success: false, 
                error: 'Este correo ya se encuentra suscrito.' 
            });
        }

        await Newsletter.create({ email });

        res.status(201).json({
            success: true,
            message: '¡Suscripción exitosa al boletín!'
        });
    } catch (error) {
        console.error('Error en subscribeNewsletter:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error interno en el servidor al procesar la suscripción.' 
        });
    }
};

module.exports = {
    // ... tus otras funciones de contacto
    subscribeNewsletter
};
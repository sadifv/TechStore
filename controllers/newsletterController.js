const Newsletter = require('../models/Newsletter');
const logger = require('../config/logger');

// @desc    Suscribir correo al newsletter
// @route   POST /api/newsletter
// @access  Public
const subscribeNewsletter = async (req, res, next) => {
    try {
        const { email } = req.body;

        const existingSubscriber = await Newsletter.findOne({ email });
        if (existingSubscriber) {
            return res.status(400).json({ 
                success: false, 
                error: 'Este correo ya se encuentra suscrito.' 
            });
        }

        await Newsletter.create({ email });
        logger.info(`Nuevo suscriptor al boletín: ${email}`);

        res.status(201).json({
            success: true,
            message: '¡Suscripción exitosa al boletín!'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    subscribeNewsletter
};
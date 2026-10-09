const Contact = require('../models/Contact');
const logger = require('../config/logger');

// @desc    Guardar mensaje de contacto
// @route   POST /api/contact
// @access  Public
const sendContactMessage = async (req, res, next) => {
    try {
        const { name, email, message } = req.body;

        const newContact = await Contact.create({
            name,
            email,
            message
        });

        logger.info(`Nuevo mensaje de contacto de: ${email}`);

        res.status(201).json({
            success: true,
            message: 'Mensaje enviado con éxito. Nos pondremos en contacto pronto.',
            data: newContact
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    sendContactMessage
};
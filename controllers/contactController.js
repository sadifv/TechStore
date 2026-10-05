const Contact = require('../models/Contact');

// @desc    Guardar mensaje de contacto
// @route   POST /api/contact
// @access  Public
const sendContactMessage = async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Por favor, completa todos los campos requeridos.' 
            });
        }

        const newContact = await Contact.create({
            name,
            email,
            message
        });

        res.status(201).json({
            success: true,
            message: 'Mensaje enviado con éxito. Nos pondremos en contacto pronto.',
            data: newContact
        });
    } catch (error) {
        console.error('Error al guardar mensaje de contacto:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ocurrió un error en el servidor al enviar el mensaje.' 
        });
    }
};

module.exports = {
    sendContactMessage
};
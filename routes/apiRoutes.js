const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../controllers/contactController');

// Ruta para procesar el formulario de contacto
router.post('/contact', sendContactMessage);

module.exports = router;
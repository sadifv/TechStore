const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Ruta principal para renderizar la Landing Page
router.get('/', async (req, res) => {
    try {
        const products = await Product.find().lean();
        
        res.render('index', {
            title: 'TechStore - Inicio',
            products: products
        });
    } catch (error) {
        console.error('Error al cargar la página principal:', error);
        res.render('index', {
            title: 'TechStore - Inicio',
            products: []
        });
    }
});

module.exports = router;
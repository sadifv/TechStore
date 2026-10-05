const express = require('express');
const router = express.Router();

// Ruta principal para cargar la Landing Page
router.get('/', (req, res) => {
  // Productos de ejemplo para renderizar en el catálogo
  const products = [
    {
      id: 1,
      name: 'Audífonos Bluetooth Pro',
      price: 49.99,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80'
    },
    {
      id: 2,
      name: 'Smartwatch Deportivo',
      price: 89.99,
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80'
    },
    {
      id: 3,
      name: 'Teclado Mecánico RGB',
      price: 69.99,
      image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&q=80'
    }
  ];

  res.render('index', { 
    title: 'TechStore - Inicio',
    products 
  });
});

module.exports = router;
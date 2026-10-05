const Product = require('../models/Product');

// @desc    Obtener todos los productos
// @route   GET /api/products
// @access  Public
const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find().lean();
        res.status(200).json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({
            success: false,
            error: 'Error del servidor al obtener el catálogo'
        });
    }
};

module.exports = {
    getAllProducts
};
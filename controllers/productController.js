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

// @desc    Crear un nuevo producto
// @route   POST /admin/products
// @access  Private/Admin
const createProduct = async (req, res) => {
    try {
        const { name, description, price, image, category, stock } = req.body;
        const newProduct = await Product.create({
            name,
            description,
            price,
            image,
            category,
            stock
        });

        res.status(201).json({
            success: true,
            data: newProduct
        });
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(400).json({
            success: false,
            error: 'Error al crear producto. Verifica los campos requeridos.'
        });
    }
};

// @desc    Actualizar un producto existente
// @route   PUT /admin/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: updatedProduct
        });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(400).json({
            success: false,
            error: 'Error al actualizar el producto'
        });
    }
};

// @desc    Eliminar un producto
// @route   DELETE /admin/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Producto eliminado correctamente'
        });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar el producto'
        });
    }
};

module.exports = {
    getAllProducts,
    createProduct,
    updateProduct,
    deleteProduct
};
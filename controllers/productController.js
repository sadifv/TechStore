const Product = require('../models/Product');

// @desc    Obtener todos los productos con filtros, búsqueda, ordenamiento y paginación
// @route   GET /api/products
// @access  Public
const getAllProducts = async (req, res, next) => {
    try {
        const { page = 1, limit = 8, category, search, sort } = req.query;

        // Sanitización defensiva de parámetros numéricos
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 8)); // Límite máximo de 50 por seguridad
        const skip = (pageNum - 1) * limitNum;

        const query = {};

        // Filtro por categoría exacta
        if (category) {
            query.category = category;
        }

        // Búsqueda por nombre de producto (case insensitive)
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        // Criterio de ordenamiento
        let sortOption = { createdAt: -1 };
        if (sort === 'price_asc') sortOption = { price: 1 };
        if (sort === 'price_desc') sortOption = { price: -1 };
        if (sort === 'name_asc') sortOption = { name: 1 };

        // Consultas en paralelo para optimizar tiempo de respuesta
        const [products, total] = await Promise.all([
            Product.find(query).sort(sortOption).skip(skip).limit(limitNum).lean(),
            Product.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limitNum) || 1;

        res.status(200).json({
            success: true,
            products,
            pagination: {
                totalProducts: total,
                totalPages,
                currentPage: pageNum,
                limit: limitNum,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener un producto por ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id).lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado.'
            });
        }

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Crear un nuevo producto
// @route   POST /admin/products
// @access  Private/Admin
const createProduct = async (req, res, next) => {
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
        next(error);
    }
};

// @desc    Actualizar un producto existente
// @route   PUT /admin/products/:id
// @access  Private/Admin
const updateProduct = async (req, res, next) => {
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
        next(error);
    }
};

// @desc    Eliminar un producto
// @route   DELETE /admin/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res, next) => {
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
        next(error);
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
};
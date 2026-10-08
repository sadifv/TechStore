const Product = require('../models/Product');
const logger = require('../config/logger');

// @desc    Obtener todos los productos con filtros, búsqueda, ordenamiento y paginación
// @route   GET /api/products
// @access  Public
const getAllProducts = async (req, res, next) => {
    try {
        const { page = 1, limit = 8, category, search, sort } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 8));
        const skip = (pageNum - 1) * limitNum;

        const query = {};

        if (category && category !== 'all') {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        let sortOption = { createdAt: -1 };
        if (sort === 'price_asc' || sort === 'price-asc') sortOption = { price: 1 };
        if (sort === 'price_desc' || sort === 'price-desc') sortOption = { price: -1 };
        if (sort === 'name_asc' || sort === 'name-asc') sortOption = { name: 1 };

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

// @desc    Activar flash sale en un producto
// @route   POST /admin/products/:id/flash-sale
// @access  Private/Admin
const activateFlashSale = async (req, res, next) => {
    try {
        const { discount, durationHours = 24 } = req.body;

        if (!discount || discount < 1 || discount > 90) {
            return res.status(400).json({
                success: false,
                error: 'El descuento debe estar entre 1 y 90%.'
            });
        }

        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado.'
            });
        }

        if (product.flashSale && product.flashSaleEndsAt > new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Este producto ya tiene una oferta activa. Detén la actual primero.'
            });
        }

        const originalPrice = product.originalPrice || product.price;
        // Redondeo correcto: evita errores de punto flotante (ej. 19.995 -> 20.00 no 19.99)
        const discountedPrice = Math.round(originalPrice * (100 - discount)) / 100;

        const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

        product.flashSale = true;
        product.flashSaleDiscount = discount;
        product.flashSaleEndsAt = endsAt;
        product.originalPrice = originalPrice;
        product.price = discountedPrice;

        await product.save();

        logger.info(`Flash sale activada: ${product.name} - ${discount}% - Termina: ${endsAt.toISOString()}`);

        res.status(200).json({
            success: true,
            message: `Oferta activada en "${product.name}" con ${discount}% de descuento.`,
            data: {
                originalPrice,
                discountedPrice,
                endsAt,
                discount
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Desactivar flash sale en un producto (restaura el precio)
// @route   DELETE /admin/products/:id/flash-sale
// @access  Private/Admin
const deactivateFlashSale = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado.'
            });
        }

        if (!product.flashSale && !product.originalPrice) {
            return res.status(400).json({
                success: false,
                error: 'Este producto no tiene una oferta activa.'
            });
        }

        if (product.originalPrice !== null && product.originalPrice !== undefined) {
            product.price = product.originalPrice;
        } else {
            // Fallback: mantener precio actual y log warning
            logger.warn(`deactivateFlashSale: ${product.name} (ID: ${product._id}) no tiene originalPrice válido, se mantiene precio actual $${product.price}`);
        }

        product.flashSale = false;
        product.flashSaleDiscount = 0;
        product.flashSaleEndsAt = null;
        product.originalPrice = null;

        await product.save();

        logger.info(`Flash sale desactivada: ${product.name} - Precio restaurado a $${product.price}`);

        res.status(200).json({
            success: true,
            message: `Oferta detenida en "${product.name}". Precio restaurado.`,
            data: { price: product.price }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mostrar la página de detalle de un producto
// @route   GET /producto/:id
// @access  Public
const getProductDetailPage = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id).lean();

        if (!product) {
            return res.status(404).render('404', {
                title: 'Producto no encontrado | TechStore',
                message: 'El producto que buscas no existe o fue eliminado.'
            });
        }

        res.render('product-detail', {
            title: `${product.name} | TechStore`,
            product
        });
    } catch (error) {
        // Si el ID no es válido (CastError), muestra 404
        if (error.name === 'CastError') {
            return res.status(404).render('404', {
                title: 'Producto no encontrado | TechStore',
                message: 'El producto que buscas no existe o fue eliminado.'
            });
        }
        next(error);
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    activateFlashSale,
    deactivateFlashSale,
    getProductDetailPage
};
const Product = require('../models/Product');
const logger = require('../config/logger');

// ==========================================
// OBTENER PRODUCTOS
// ==========================================

// @desc    Obtener productos con filtros y paginación
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res, next) => {
    try {
        const { category, search, limit = 8, page = 1, sort = 'recent' } = req.query;
        const query = {};

        if (category && category !== 'all') {
            query.category = category;
        }

        if (search) {
            query.name = { $regex: search,$options: 'i' };
        }

        // Configurar ordenamiento
        let sortOption = {};
        switch (sort) {
            case 'price_asc':
                sortOption = { price: 1 };
                break;
            case 'price_desc':
                sortOption = { price: -1 };
                break;
            case 'name_asc':
                sortOption = { name: 1 };
                break;
            case 'recent':
            default:
                sortOption = { createdAt: -1 };
                break;
        }

        // Paginación
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 8));
        const skip = (pageNum - 1) * limitNum;

        const [products, totalCount] = await Promise.all([
            Product.find(query)
                .sort(sortOption)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Product.countDocuments(query)
        ]);

        const totalPages = Math.ceil(totalCount / limitNum) || 1;

        res.status(200).json({
            success: true,
            count: products.length,
            products,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalCount,
                hasPrevPage: pageNum > 1,
                hasNextPage: pageNum < totalPages
            }
        });
    } catch (error) {
        logger.error(`Error al obtener productos: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

// ==========================================
// OBTENER PRODUCTO POR ID (API)
// ==========================================

// @desc    Obtener un producto individual por ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id).lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Recurso no encontrado.'
            });
        }

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                error: 'Recurso no encontrado.'
            });
        }
        logger.error(`Error al obtener producto por ID: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

// ==========================================
// DETALLE DE PRODUCTO (WEB)
// ==========================================

// @desc    Vista de detalle de un producto individual
// @route   GET /producto/:id
// @access  Public
const getProductDetailPage = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id).lean();

        if (!product) {
            return res.status(404).render('404', {
                title: 'Producto No Encontrado | TechStore',
                message: 'El producto que buscas no existe o ha sido eliminado.'
            });
        }

        res.render('product-detail', {
            title: `${product.name} | TechStore`,
            product
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).render('404', {
                title: 'Producto No Encontrado | TechStore',
                message: 'El producto que buscas no existe o ha sido eliminado.'
            });
        }
        logger.error(`Error al cargar detalle del producto: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

// ==========================================
// CRUD PRODUCTOS
// ==========================================

const createProduct = async (req, res, next) => {
    try {
        const { name, description, price, category, stock, image } = req.body;

        let imagePath = '/images/default-product.png';
        if (req.file) {
            imagePath = `/uploads/products/${req.file.filename}`;
        } else if (image && image.trim() !== '') {
            imagePath = image.trim();
        }

        const newProduct = await Product.create({
            name,
            description,
            price: Number(price),
            category,
            stock: Number(stock),
            image: imagePath
        });

        logger.info(`Nuevo producto creado: ${newProduct.name} (ID: ${newProduct._id})`);

        res.status(201).json({
            success: true,
            data: newProduct
        });
    } catch (error) {
        logger.error(`Error al crear producto: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

const updateProduct = async (req, res, next) => {
    try {
        const { name, description, price, category, stock, image } = req.body;

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        let imagePath = product.image;
        if (req.file) {
            imagePath = `/uploads/products/${req.file.filename}`;
        } else if (image && image.trim() !== '') {
            imagePath = image.trim();
        }

        product.name = name || product.name;
        product.description = description !== undefined ? description : product.description;
        product.price = price !== undefined ? Number(price) : product.price;
        product.category = category || product.category;
        product.stock = stock !== undefined ? Number(stock) : product.stock;
        product.image = imagePath;

        await product.save();

        logger.info(`Producto actualizado: ${product.name} (ID: ${product._id})`);

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        logger.error(`Error al actualizar producto: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

const deleteProduct = async (req, res, next) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        logger.info(`Producto eliminado: ${product.name} (ID: ${product._id})`);

        res.status(200).json({
            success: true,
            message: 'Producto eliminado correctamente.'
        });
    } catch (error) {
        logger.error(`Error al eliminar producto: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

// ==========================================
// FLASH SALE
// ==========================================

const activateFlashSale = async (req, res, next) => {
    try {
        const { discount, durationHours } = req.body;
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado' });
        }

        if (product.flashSale && product.flashSaleEndsAt && new Date(product.flashSaleEndsAt) > new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Este producto ya tiene una oferta activa. Detén la actual primero.'
            });
        }

        const discountNum = Number(discount);
        const durationNum = Number(durationHours);

        if (isNaN(discountNum) || discountNum <= 0 || discountNum > 90) {
            return res.status(400).json({ success: false, error: 'El descuento debe ser entre 1% y 90%' });
        }

        if (isNaN(durationNum) || durationNum <= 0 || durationNum > 168) {
            return res.status(400).json({ success: false, error: 'La duración debe ser entre 1 y 168 horas' });
        }

        const originalPrice = (
            typeof product.originalPrice === 'number' && product.originalPrice >= 0
                ? product.originalPrice
                : product.price
        );

        if (typeof originalPrice !== 'number' || originalPrice < 0) {
            return res.status(400).json({
                success: false,
                error: 'El producto no tiene un precio válido para aplicar descuento.'
            });
        }

        const discountedPrice = originalPrice * (1 - discountNum / 100);
        const endsAt = new Date(Date.now() + durationNum * 60 * 60 * 1000);

        product.originalPrice = originalPrice;
        product.price = Number(discountedPrice.toFixed(2));
        product.flashSale = true;
        product.flashSaleDiscount = discountNum;
        product.flashSaleEndsAt = endsAt;

        await product.save();

        logger.info(`Flash sale activada: ${product.name} - ${discountNum}% - Termina: ${endsAt.toISOString()}`);

        res.status(200).json({
            success: true,
            message: `Oferta activada en "${product.name}" con ${discountNum}% de descuento.`,
            product
        });
    } catch (error) {
        logger.error(`Error al activar flash sale: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

const deactivateFlashSale = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado' });
        }

        if (!product.flashSale && product.originalPrice === null) {
            return res.status(400).json({
                success: false,
                error: 'Este producto no tiene una oferta activa.'
            });
        }

        if (typeof product.originalPrice === 'number' && product.originalPrice >= 0) {
            product.price = product.originalPrice;
        } else {
            logger.warn(
                `Producto "${product.name}" (ID: ${product._id}) no tenía originalPrice válido. Precio actual: ${product.price}`
            );
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
            product
        });
    } catch (error) {
        logger.error(`Error al desactivar flash sale: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

module.exports = {
    getProducts,
    getProductById,
    getProductDetailPage,
    createProduct,
    updateProduct,
    deleteProduct,
    activateFlashSale,
    deactivateFlashSale
};
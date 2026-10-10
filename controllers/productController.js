const Product = require('../models/Product');
const logger = require('../config/logger');

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
            query.name = { $regex: search, $options: 'i' };
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
        const limitNum = Math.max(1, parseInt(limit, 10) || 8);
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
        logger.error(`Error al obtener productos: ${error.message}`);
        next(error);
    }
};

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
        logger.error(`Error al cargar detalle del producto: ${error.message}`);
        next(error);
    }
};

// @desc    Crear un nuevo producto
// @route   POST /admin/products
// @access  Private/Admin
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
        logger.error(`Error al crear producto: ${error.message}`);
        next(error);
    }
};

// @desc    Actualizar un producto existente
// @route   PUT /admin/products/:id
// @access  Private/Admin
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
        logger.error(`Error al actualizar producto: ${error.message}`);
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

        logger.info(`Producto eliminado: ${product.name} (ID: ${product._id})`);

        res.status(200).json({
            success: true,
            message: 'Producto eliminado correctamente.'
        });
    } catch (error) {
        logger.error(`Error al eliminar producto: ${error.message}`);
        next(error);
    }
};

// @desc    Activar Oferta Relámpago (Flash Sale)
// @route   POST /admin/products/:id/flash-sale
// @access  Private/Admin
const activateFlashSale = async (req, res, next) => {
    try {
        const { discount, durationHours } = req.body;
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado' });
        }

        const discountNum = Number(discount);
        const durationNum = Number(durationHours);

        if (isNaN(discountNum) || discountNum <= 0 || discountNum > 90) {
            return res.status(400).json({ success: false, error: 'El descuento debe ser entre 1% y 90%' });
        }

        const originalPrice = product.originalPrice || product.price;
        const discountedPrice = originalPrice * (1 - discountNum / 100);
        const endsAt = new Date(Date.now() + durationNum * 60 * 60 * 1000);

        product.originalPrice = originalPrice;
        product.price = Number(discountedPrice.toFixed(2));
        product.flashSale = true;
        product.flashSaleDiscount = discountNum;
        product.flashSaleEndsAt = endsAt;

        await product.save();

        logger.info(`Oferta relámpago activada para ${product.name}: ${discountNum}% off`);

        res.status(200).json({
            success: true,
            message: 'Oferta relámpago activada con éxito.',
            product
        });
    } catch (error) {
        logger.error(`Error al activar flash sale: ${error.message}`);
        next(error);
    }
};

// @desc    Desactivar Oferta Relámpago
// @route   DELETE /admin/products/:id/flash-sale
// @access  Private/Admin
const deactivateFlashSale = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado' });
        }

        if (product.originalPrice) {
            product.price = product.originalPrice;
        }

        product.flashSale = false;
        product.flashSaleDiscount = undefined;
        product.flashSaleEndsAt = undefined;
        product.originalPrice = undefined;

        await product.save();

        logger.info(`Oferta relámpago desactivada para ${product.name}`);

        res.status(200).json({
            success: true,
            message: 'Oferta relámpago detenida y precio restaurado.',
            product
        });
    } catch (error) {
        logger.error(`Error al desactivar flash sale: ${error.message}`);
        next(error);
    }
};

module.exports = {
    getProducts,
    getProductDetailPage,
    createProduct,
    updateProduct,
    deleteProduct,
    activateFlashSale,
    deactivateFlashSale
};
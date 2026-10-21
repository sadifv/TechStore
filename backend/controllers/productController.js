const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const logger = require('../config/logger');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getProducts = async (req, res, next) => {
  try {
    const { category, search, limit = 50, page = 1, sort = 'recent' } = req.query;
    const query = {};

    if (typeof category === 'string' && category.length <= 80 && category !== 'all') {
      query.category = category;
    }

    const normalizedSearch = typeof search === 'string' ? search.trim().slice(0, 100) : '';
    if (normalizedSearch) {
      query.name = { $regex: escapeRegex(normalizedSearch), $options: 'i' };
    }

    let sortOption = {};
    switch (typeof sort === 'string' ? sort : 'recent') {
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

    const pageNum = Math.max(1, Math.min(1000, parseInt(page, 10) || 1));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [products, totalCount] = await Promise.all([
      Product.find(query).sort(sortOption).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(query),
    ]);

    // Calcular stock disponible descontando reservas activas
    const reservedByProduct = await Reservation.getReservedStockByProducts(
      products.map((product) => product._id),
    );
    const productsWithAvailability = products.map((product) => ({
      ...product,
      availableStock: Math.max(
        0,
        product.stock - (reservedByProduct.get(String(product._id)) || 0),
      ),
    }));

    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    res.status(200).json({
      success: true,
      count: productsWithAvailability.length,
      products: productsWithAvailability,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasPrevPage: pageNum > 1,
        hasNextPage: pageNum < totalPages,
      },
    });
  } catch (error) {
    logger.error(`Error al obtener productos: ${error.message}`, { stack: error.stack });
    next(error);
  }
};

const getHomeProducts = async (req, res, next) => {
  try {
    const now = new Date();
    const productFields = '_id name price image stock flashSale flashSaleDiscount flashSaleEndsAt originalPrice createdAt';
    const [products, sales] = await Promise.all([
      Product.find({}).select(productFields).sort({ createdAt: -1 }).limit(8).lean(),
      Product.find({ flashSale: true, flashSaleEndsAt: { $gt: now } })
        .select(productFields).sort({ flashSaleEndsAt: 1 }).limit(1).lean(),
    ]);
    const reservedByProduct = await Reservation.getReservedStockByProducts(products.map((product) => product._id));
    const productsWithAvailability = products.map((product) => ({
      ...product,
      availableStock: Math.max(0, product.stock - (reservedByProduct.get(String(product._id)) || 0)),
    }));
    return res.status(200).json({ success: true, products: productsWithAvailability, flashSale: sales[0] || null });
  } catch (error) {
    logger.error('Error al obtener los productos del inicio.', { errorCode: error.code || error.name });
    return next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ success: false, error: 'Recurso no encontrado.' });
    }
    const reservedStock = await Reservation.getReservedStock(product._id);
    product.availableStock = Math.max(0, product.stock - reservedStock);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, error: 'Recurso no encontrado.' });
    }
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, category, stock, image } = req.body;
    let imagePath = '/images/products/product-placeholder.svg';
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
      image: imagePath,
    });

    res.status(201).json({ success: true, data: newProduct });
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { name, description, price, category, stock, image } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
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
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }
    res.status(200).json({ success: true, message: 'Producto eliminado correctamente.' });
  } catch (error) {
    next(error);
  }
};

const activateFlashSale = async (req, res, next) => {
  try {
    const { discount, durationHours } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    const discountNum = Number(discount);
    const durationNum = Number(durationHours);
    const originalPrice = product.originalPrice ?? product.price;

    const discountedPrice = originalPrice * (1 - discountNum / 100);
    const endsAt = new Date(Date.now() + durationNum * 60 * 60 * 1000);

    product.originalPrice = originalPrice;
    product.price = Number(discountedPrice.toFixed(2));
    product.flashSale = true;
    product.flashSaleDiscount = discountNum;
    product.flashSaleEndsAt = endsAt;

    await product.save();
    res.status(200).json({ success: true, message: 'Oferta activada con éxito.', product });
  } catch (error) {
    next(error);
  }
};

const deactivateFlashSale = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    if (product.originalPrice !== null && product.originalPrice !== undefined) {
      product.price = product.originalPrice;
    }

    product.flashSale = false;
    product.flashSaleDiscount = 0;
    product.flashSaleEndsAt = null;
    product.originalPrice = null;

    await product.save();
    res
      .status(200)
      .json({ success: true, message: 'Oferta detenida y precio restaurado.', product });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getHomeProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  activateFlashSale,
  deactivateFlashSale,
};

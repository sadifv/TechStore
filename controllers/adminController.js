const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const logger = require('../config/logger');

// @desc    Dashboard principal de Admin (Métricas)
// @route   GET /admin/dashboard
// @access  Private/Admin
const getDashboard = async (req, res, next) => {
    try {
        const [totalOrders, totalProducts, totalUsers, recentOrders] = await Promise.all([
            Order.countDocuments(),
            Product.countDocuments(),
            User.countDocuments({ role: 'user' }),
            Order.find()
                .populate('user', 'name email')
                .sort({ createdAt: -1 })
                .limit(5)
                .lean()
        ]);

        res.render('admin/dashboard', {
            title: 'Panel de Administración | TechStore',
            stats: { totalOrders, totalProducts, totalUsers },
            recentOrders
        });
    } catch (error) {
        logger.error(`Error al cargar el dashboard de admin: ${error.message}`);
        next(error);
    }
};

// @desc    Obtener lista de órdenes con paginación y filtro por estado
// @route   GET /admin/orders
// @access  Private/Admin
const getAdminOrders = async (req, res, next) => {
    try {
        const { page = 1, status } = req.query;
        const limit = 10;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const skip = (pageNum - 1) * limit;

        const filter = {};
        if (status) {
            filter.status = status;
        }

        const [orders, totalOrders] = await Promise.all([
            Order.find(filter)
                .populate('user', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalOrders / limit) || 1;

        res.render('admin/orders', {
            title: 'Gestión de Órdenes | Admin TechStore',
            orders,
            currentStatus: status || '',
            pagination: {
                currentPage: pageNum,
                totalPages
            }
        });
    } catch (error) {
        logger.error(`Error al obtener órdenes en admin: ${error.message}`);
        next(error);
    }
};

// @desc    Ver el detalle individual de una orden
// @route   GET /admin/orders/:id
// @access  Private/Admin
const getAdminOrderDetail = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email')
            .populate('items.product', 'name price image')
            .lean();

        if (!order) {
            return res.status(404).render('404', { title: 'Orden no encontrada' });
        }

        res.render('admin/order-detail', {
            title: `Detalle de Orden #${order._id} | Admin`,
            order
        });
    } catch (error) {
        logger.error(`Error al obtener detalle de orden: ${error.message}`);
        next(error);
    }
};

// @desc    Vista e impresión de Hoja de Empaque (Packing Slip)
// @route   GET /admin/orders/:id/packing-slip
// @access  Private/Admin
const getPackingSlip = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email')
            .populate('items.product', 'name price')
            .lean();

        if (!order) {
            return res.status(404).render('404', { title: 'Orden no encontrada' });
        }

        res.render('admin/packing-slip', {
            title: `Packing Slip - #${order._id}`,
            order,
            layout: false
        });
    } catch (error) {
        logger.error(`Error al generar Packing Slip: ${error.message}`);
        next(error);
    }
};

module.exports = {
    getDashboard,
    getAdminOrders,
    getAdminOrderDetail,
    getPackingSlip
};
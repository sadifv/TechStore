const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Contact = require('../models/Contact');
const Newsletter = require('../models/Newsletter');
const logger = require('../config/logger');

// ==========================================
// DASHBOARD
// ==========================================
const getAdminDashboard = async (req, res, next) => {
    try {
        const [
            productsCount,
            ordersCount,
            usersCount,
            messagesCount,
            subscribersCount,
            orders,
            users,
            messages,
            subscribers
        ] = await Promise.all([
            Product.countDocuments(),
            Order.countDocuments(),
            User.countDocuments(),
            Contact.countDocuments(),
            Newsletter.countDocuments(),
            Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(10).lean(),
            User.find().sort({ createdAt: -1 }).limit(10).lean(),
            Contact.find().sort({ createdAt: -1 }).limit(5).lean(),
            Newsletter.find().sort({ createdAt: -1 }).lean()
        ]);

        res.render('admin/dashboard', {
            title: 'Panel de Administración | TechStore',
            stats: { productsCount, ordersCount, usersCount, messagesCount, subscribersCount },
            orders,
            users,
            messages,
            subscribers
        });
    } catch (error) {
        logger.error(`Error al cargar dashboard: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

// ==========================================
// GESTIÓN DE ÓRDENES
// ==========================================

// @desc    Lista de órdenes con paginación y filtro
// @route   GET /admin/orders
// @access  Private/Admin
const getAdminOrders = async (req, res, next) => {
    try {
        const { page = 1, status } = req.query;
        const limit = 10;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const skip = (pageNum - 1) * limit;

        // ✅ Validar status contra lista permitida
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'];
        const filter = {};
        if (status && validStatuses.includes(status)) {
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
                totalPages,
                totalOrders
            }
        });
    } catch (error) {
        logger.error(`Error al obtener órdenes: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

// @desc    Detalle individual de una orden
// @route   GET /admin/orders/:id
// @access  Private/Admin
const getAdminOrderDetail = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email')
            .populate('items.product', 'name price image')
            .lean();

        if (!order) {
            return res.status(404).render('404', {
                title: 'Orden no encontrada | TechStore',
                message: 'La orden que buscas no existe o ha sido eliminada.'
            });
        }

        res.render('admin/order-detail', {
            title: `Detalle de Orden #${order._id} | Admin`,
            order
        });
    } catch (error) {
        // CastError = ID inválido → 404
        if (error.name === 'CastError') {
            return res.status(404).render('404', {
                title: 'Orden no encontrada | TechStore',
                message: 'La orden que buscas no existe o ha sido eliminada.'
            });
        }
        logger.error(`Error al obtener detalle de orden: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

// @desc    Vista e impresión de Packing Slip
// @route   GET /admin/orders/:id/packing-slip
// @access  Private/Admin
const getPackingSlip = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email')
            .populate('items.product', 'name price')
            .lean();

        if (!order) {
            return res.status(404).render('404', {
                title: 'Orden no encontrada | TechStore',
                message: 'La orden que buscas no existe o ha sido eliminada.'
            });
        }

        res.render('admin/packing-slip', {
            title: `Packing Slip - #${order._id}`,
            order,
            layout: false
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).render('404', {
                title: 'Orden no encontrada | TechStore',
                message: 'La orden que buscas no existe o ha sido eliminada.'
            });
        }
        logger.error(`Error al generar Packing Slip: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

// ==========================================
// GESTIÓN DE USUARIOS
// ==========================================
const getAdminUsers = async (req, res, next) => {
    try {
        const { page = 1, search, role } = req.query;
        const limit = 20;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const skip = (pageNum - 1) * limit;

        const filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        if (role && ['user', 'admin'].includes(role)) {
            filter.role = role;
        }

        const [users, totalUsers] = await Promise.all([
            User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            User.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalUsers / limit) || 1;

        res.render('admin/users', {
            title: 'Gestión de Usuarios | Admin',
            users,
            currentSearch: search || '',
            currentRole: role || '',
            pagination: { currentPage: pageNum, totalPages, totalUsers }
        });
    } catch (error) {
        logger.error(`Error al obtener usuarios: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
    getAdminDashboard,
    getAdminOrders,
    getAdminOrderDetail,
    getPackingSlip,
    getAdminUsers
};
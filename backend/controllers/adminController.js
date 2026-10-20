const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Contact = require('../models/Contact');
const Newsletter = require('../models/Newsletter');
const Cart = require('../models/Cart');
const Presence = require('../models/Presence');
const { isOnline } = require('../services/presenceService');
const logger = require('../config/logger');

const respondWithAdminData = (res, data) => {
  const { title, ...payload } = data;
  return res.json({ success: true, data: payload });
};

const getAdminDashboard = async (req, res, next) => {
  try {
    const subscriberLimit = 20;
    const parsedSubscriberPage = Number.parseInt(req.query.subscribersPage, 10);
    const requestedSubscriberPage =
      Number.isSafeInteger(parsedSubscriberPage) && parsedSubscriberPage > 0
        ? parsedSubscriberPage
        : 1;
    const [
      productsCount,
      ordersCount,
      usersCount,
      messagesCount,
      subscribersCount,
      activeCartCount,
      paidOrderStats,
      topProducts,
      products,
      orders,
      users,
      messages,
    ] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      User.countDocuments(),
      Contact.countDocuments(),
      Newsletter.countDocuments(),
      Cart.countDocuments({ 'items.0': { $exists: true } }),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            totalProductsSold: {
              $sum: {
                $reduce: {
                  input: '$items',
                  initialValue: 0,
                  in: { $add: ['$$value', '$$this.quantity'] },
                },
              },
            },
          },
        },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            unitsSold: { $sum: '$items.quantity' },
          },
        },
        { $sort: { unitsSold: -1 } },
        { $limit: 6 },
        {
          $lookup: {
            from: Product.collection.name,
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $project: {
            _id: '$product._id',
            name: '$product.name',
            price: '$product.price',
            image: '$product.image',
            unitsSold: 1,
          },
        },
      ]),
      Product.find().sort({ createdAt: -1 }).limit(100).lean(),
      Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(10).lean(),
      User.find()
        .select('name email role createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Contact.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const subscriberTotalPages = Math.max(1, Math.ceil(subscribersCount / subscriberLimit));
    const subscriberPage = Math.min(requestedSubscriberPage, subscriberTotalPages);
    const currentSubscribers = await Newsletter.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip((subscriberPage - 1) * subscriberLimit)
      .limit(subscriberLimit)
      .lean();

    const { totalRevenue = 0, totalProductsSold = 0 } = paidOrderStats[0] || {};

    respondWithAdminData(res, {
      title: 'Panel de Administración | TechStore',
      stats: { productsCount, ordersCount, usersCount, messagesCount, subscribersCount },
      totalOrders: ordersCount,
      totalRevenue,
      totalProductsSold,
      activeCartCount,
      products,
      topProducts,
      orders,
      users,
      messages,
      subscribers: currentSubscribers,
      subscriberPagination: {
        currentPage: subscriberPage,
        totalPages: subscriberTotalPages,
        totalSubscribers: subscribersCount,
      },
    });
  } catch (error) {
    logger.error(`Error al cargar dashboard: ${error.message}`, { stack: error.stack });
    next(error);
  }
};

const getAdminOrders = async (req, res, next) => {
  try {
    const { page = 1, status } = req.query;
    const limit = 10;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const skip = (pageNum - 1) * limit;

    const validStatuses = [
      'pending',
      'processing',
      'shipped',
      'delivered',
      'completed',
      'cancelled',
    ];
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
      Order.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalOrders / limit) || 1;

    respondWithAdminData(res, {
      title: 'Gestión de Órdenes | Admin TechStore',
      orders,
      currentStatus: status || '',
      pagination: { currentPage: pageNum, totalPages, totalOrders },
    });
  } catch (error) {
    logger.error(`Error al obtener órdenes: ${error.message}`, { stack: error.stack });
    next(error);
  }
};

const getAdminOrderDetail = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('events.actor', 'name')
      .populate('items.product', 'name price image')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, error: 'La orden no existe.' });
    }

    respondWithAdminData(res, { title: `Detalle de Orden #${order._id} | Admin`, order });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, error: 'La orden no existe.' });
    }
    logger.error(`Error al obtener detalle de orden: ${error.message}`, { stack: error.stack });
    next(error);
  }
};

const getPackingSlip = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('items.product', 'name price')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, error: 'La orden no existe.' });
    }

    respondWithAdminData(res, { title: `Packing Slip - #${order._id}`, order });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, error: 'La orden no existe.' });
    }
    logger.error(`Error al generar Packing Slip: ${error.message}`, { stack: error.stack });
    next(error);
  }
};

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
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (role && ['user', 'admin'].includes(role)) {
      filter.role = role;
    }

    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select('name email role createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const presences = users.length
      ? await Presence.find({ user: { $in: users.map((user) => user._id) } })
          .select('user lastSeenAt')
          .lean()
      : [];
    const presenceByUser = new Map(
      presences.map((presence) => [String(presence.user), presence.lastSeenAt]),
    );
    const usersWithPresence = users.map((user) => {
      const lastSeenAt = presenceByUser.get(String(user._id)) || null;
      return { ...user, isOnline: isOnline(lastSeenAt), lastSeenAt };
    });

    const totalPages = Math.ceil(totalUsers / limit) || 1;

    respondWithAdminData(res, {
      title: 'Gestión de Usuarios | Admin',
      users: usersWithPresence,
      currentSearch: search || '',
      currentRole: role || '',
      pagination: { currentPage: pageNum, totalPages, totalUsers },
    });
  } catch (error) {
    logger.error(`Error al obtener usuarios: ${error.message}`, { stack: error.stack });
    next(error);
  }
};

module.exports = {
  getAdminDashboard,
  getAdminOrders,
  getAdminOrderDetail,
  getPackingSlip,
  getAdminUsers,
};

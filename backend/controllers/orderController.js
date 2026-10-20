const Order = require('../models/Order');
const logger = require('../config/logger');
const { createOrder } = require('./orderCheckoutController');
const { markOrderAsPaid } = require('../services/orderPayment');
const {
  restoreOrderInventory,
  expirePendingWhatsappOrders,
  pruneCompletedInventoryRestorationKeys,
} = require('../services/orderInventory');
const { actorId, orderEvent } = require('../services/orderAudit');

const getUserOrders = async (req, res, next) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({
        success: false,
        error: 'Debes iniciar sesión para ver tus órdenes.',
      });
    }

    const orders = await Order.find({ user: req.session.user.id })
      .populate('items.product', 'name price image')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    logger.error(`Error al obtener órdenes del usuario: ${error.message}`, { stack: error.stack });
    next(error);
  }
};

// ==========================================
// ACTUALIZAR ESTADO DE ORDEN (Admin)
// ==========================================

// @desc    Actualizar el estado de una orden
// @route   PUT /api/orders/:id/status o /admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['processing', 'shipped', 'delivered', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error:
          'Estado no válido. Las órdenes pagadas pueden avanzar a procesamiento, envío, entrega o completada.',
      });
    }

    const currentOrder = await Order.findById(req.params.id).select('paymentStatus status');
    if (!currentOrder) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada.' });
    }
    if (currentOrder.paymentStatus !== 'paid') {
      return res.status(409).json({
        success: false,
        error: 'No se puede cambiar el estado de envío hasta confirmar el pago.',
      });
    }
    if (currentOrder.status === status) {
      return res
        .status(200)
        .json({ success: true, message: 'La orden ya tiene ese estado.', order: currentOrder });
    }

    const nextStatuses = {
      pending: ['processing'],
      processing: ['shipped'],
      shipped: ['delivered'],
      delivered: ['completed'],
      completed: [],
    };
    if (!nextStatuses[currentOrder.status]?.includes(status)) {
      return res.status(409).json({
        success: false,
        error: 'La orden solo puede avanzar al siguiente estado del flujo de envío.',
      });
    }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, paymentStatus: 'paid', status: currentOrder.status },
      { $set: { status }, $push: { events: orderEvent(status, actorId(req)) } },
      { returnDocument: 'after' },
    );

    if (!order) {
      return res.status(409).json({
        success: false,
        error: 'La orden cambió mientras se actualizaba. Recarga e inténtalo de nuevo.',
      });
    }

    logger.info('Estado de pedido actualizado.', { orderId: String(order._id), status, actorId: actorId(req) });

    res.status(200).json({
      success: true,
      message: 'Estado de la orden actualizado correctamente.',
      order,
    });
  } catch (error) {
    logger.error(`Error al actualizar estado de orden: ${error.message}`, { stack: error.stack });
    next(error);
  }
};

const markWhatsappOrderPaid = async (req, res, next) => {
  try {
    const pendingOrder = await Order.findOne({
      _id: req.params.id,
      paymentMethod: 'whatsapp',
      paymentStatus: { $in: ['pending', 'paid'] },
    });
    if (!pendingOrder) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró un pedido de WhatsApp pendiente.',
      });
    }

    const order = await markOrderAsPaid(pendingOrder._id, actorId(req));
    if (!order) {
      return res.status(409).json({
        success: false,
        error: 'El pedido cambió mientras se confirmaba. Actualiza la página.',
      });
    }

    logger.info('Confirmación manual de pago.', { orderId: String(order._id), actorId: actorId(req) });
    return res.json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

const confirmWhatsappContact = async (req, res, next) => {
  try {
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        paymentMethod: 'whatsapp',
        paymentStatus: 'pending',
        contactConfirmedAt: { $exists: false },
        createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      {
        $set: { contactConfirmedAt: new Date(), contactConfirmedBy: actorId(req) },
        $push: { events: orderEvent('contact_confirmed', actorId(req)) },
      },
      { returnDocument: 'after' },
    );
    if (!order) {
      const existing = await Order.findOne({ _id: req.params.id, contactConfirmedAt: { $exists: true } });
      if (existing) return res.json({ success: true, order: existing });
      return res.status(409).json({ success: false, error: 'El pedido no está pendiente o ya venció.' });
    }
    logger.info('Contacto de WhatsApp confirmado por la tienda.', { orderId: String(order._id), actorId: actorId(req) });
    return res.json({ success: true, order });
  } catch (error) { next(error); }
};

const cancelWhatsappOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      paymentMethod: 'whatsapp',
      paymentStatus: { $in: ['pending', 'failed'] } });
    if (!order)
      return res.status(409).json({ success: false, error: 'Solo se pueden cancelar pedidos sin pago confirmado.' });
    const restored = await restoreOrderInventory(order._id, undefined, 'cancelled', actorId(req));
    if (!restored && !order.inventoryRestored) return res.status(409).json({ success: false, error: 'El pedido cambió. Actualiza la página.' });
    return res.json({ success: true });
  } catch (error) { next(error); }
};

module.exports = {
  confirmWhatsappContact,
  cancelWhatsappOrder,
  createOrder,
  markWhatsappOrderPaid,
  expirePendingWhatsappOrders,
  pruneCompletedInventoryRestorationKeys,
  getUserOrders,
  updateOrderStatus,
};

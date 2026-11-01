const Order = require('../models/Order');
const { isOrderSuccessAccessible } = require('../services/orderSuccessAccess');
const { customerOrderView, customerCancelConditions } = require('../services/customerOrderView');
const { restoreOrderInventory } = require('../services/orderInventory');

async function accessibleOrder(req, res) {
  res.set('Cache-Control', 'no-store');
  const { orderId, checkoutKey } = req.body || {};
  if (typeof orderId !== 'string' || !/^[a-f\d]{24}$/i.test(orderId)) {
    res.status(400).json({ success: false, error: 'Identificador de pedido inválido.' });
    return null;
  }
  const order = await Order.findById(orderId).populate('items.product', 'name').lean();
  const userId = req.user?.id || req.session?.user?.id || req.session?.user?._id;
  if (
    !order ||
    order.paymentMethod !== 'whatsapp' ||
    !isOrderSuccessAccessible({ order, userId, checkoutKey })
  ) {
    res.status(404).json({ success: false, error: 'No se encontró el pedido.' });
    return null;
  }
  return order;
}

async function getCustomerOrder(req, res, next) {
  try {
    const order = await accessibleOrder(req, res);
    if (order) res.json({ success: true, data: customerOrderView(order) });
  } catch (error) {
    next(error);
  }
}

async function cancelCustomerOrder(req, res, next) {
  try {
    let order = await accessibleOrder(req, res);
    if (!order) return;
    const alreadyCancelled = () =>
      order.status === 'cancelled' && order.inventoryRestored && order.paymentStatus !== 'paid';
    if (!alreadyCancelled()) {
      if (!customerOrderView(order).canCancel) {
        return res.status(409).json({
          success: false,
          error:
            'El pedido ya no admite cancelación directa. Actualiza el seguimiento o contacta con la tienda.',
        });
      }
      // Recheck the same ownership and transition constraints inside the transaction.
      const ownership = order.user
        ? { user: order.user }
        : { user: null, checkoutKey: order.checkoutKey };
      await restoreOrderInventory(
        order._id,
        undefined,
        'customer_cancelled',
        req.user?.id || req.session?.user?.id,
        { conditions: { ...customerCancelConditions(), ...ownership } },
      );
      order = await Order.findById(order._id).populate('items.product', 'name').lean();
      if (!order || !alreadyCancelled()) {
        return res.status(409).json({
          success: false,
          error: 'El pedido cambió mientras se cancelaba. Actualiza el seguimiento.',
        });
      }
    }
    return res.json({ success: true, data: customerOrderView(order) });
  } catch (error) {
    next(error);
  }
}
module.exports = { getCustomerOrder, cancelCustomerOrder };

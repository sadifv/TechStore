const mongoose = require('mongoose');
const crypto = require('node:crypto');
const { getWhatsappPhone, buildWhatsappOrderUrl } = require('../config/whatsapp');
const { orderEvent } = require('../services/orderAudit');

const respondToRetry = (order, requestHash, req, res) => {
  if (order.checkoutRequestHash !== requestHash) {
    return res
      .status(409)
      .json({ success: false, error: 'Este intento corresponde a otro carrito.' });
  }
  if (order.paymentStatus === 'failed' && order.inventoryRestored) {
    return res
      .status(409)
      .json({
        success: false,
        checkoutRetryAllowed: true,
        error:
          'El pedido anterior fue cancelado y su reserva se liberó. Pulsa de nuevo para crear otro pedido.',
      });
  }
  if (
    order.paymentStatus === 'pending' &&
    order.createdAt <= new Date(Date.now() - 24 * 60 * 60 * 1000)
  ) {
    return res
      .status(409)
      .json({
        success: false,
        error: 'La reserva del pedido venció. Contacta con la tienda para reanudar la compra.',
      });
  }
  if (order.checkoutState !== 'ready' || order.paymentStatus === 'failed') {
    return res
      .status(409)
      .json({
        success: false,
        error:
          'El pedido está en proceso o no pudo completarse. Revisa tus pedidos antes de iniciar otro intento.',
      });
  }
  return res.json({
    success: true,
    orderId: order._id,
    whatsappUrl: buildWhatsappOrderUrl(order, req.session?.user),
  });
};
const Order = require('../models/Order');
const { createCheckout } = require('../services/checkoutService');
const createOrder = async (req, res, next) => {
  let checkoutKey, checkoutRequestHash;
  try {
    getWhatsappPhone();
    const { items, guestInfo, shippingAddress, couponCode, checkoutKey: key } = req.body || {};
    const userId = req.session?.user?.id || req.session?.user?._id;
    if (key !== undefined) {
      if (typeof key !== 'string' || !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(key)) return res.status(400).json({ success: false, error: 'Identificador de intento inválido.' });
      checkoutKey = crypto.createHash('sha256').update(`${userId || 'guest'}:${key}`).digest('hex');
      const payload = { ...req.body }; delete payload.checkoutKey;
      checkoutRequestHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      const existing = await Order.findOne({ checkoutKey });
      if (existing) return respondToRetry(existing, checkoutRequestHash, req, res);
    }
    if (!Array.isArray(items) || !items.length || items.length > 50) return res.status(400).json({ success: false, error: 'La orden debe incluir entre 1 y 50 productos.' });
    const normalized = new Map();
    for (const item of items) {
      if (!mongoose.isObjectIdOrHexString(item?.productId)) return res.status(400).json({ success: false, error: 'Cada item debe tener un productId válido.' });
      const quantity = Number(item.quantity ?? 1);
      const total = (normalized.get(String(item.productId)) || 0) + quantity;
      if (!Number.isInteger(quantity) || quantity < 1 || total > 99) return res.status(400).json({ success: false, error: 'La cantidad por producto debe ser entre 1 y 99.' });
      normalized.set(String(item.productId), total);
    }
    if (!userId && (typeof guestInfo?.name !== 'string' || !guestInfo.name.trim() || typeof guestInfo?.email !== 'string' || !/^\S+@\S+\.\S+$/.test(guestInfo.email))) return res.status(400).json({ success: false, error: 'Para compras como invitado se requiere nombre y correo válido.' });
    const result = await createCheckout({ items: [...normalized].map(([productId, quantity]) => ({ productId, quantity })), userId, guestInfo, shippingAddress, couponCode, checkoutKey, checkoutRequestHash });
    if (!result.created) return respondToRetry(result.order, checkoutRequestHash, req, res);
    return res.status(201).json({ success: true, orderId: result.order._id, whatsappUrl: buildWhatsappOrderUrl(result.order, req.session?.user) });
  } catch (error) {
    if (error.code === 11000 && checkoutKey) {
      const existing = await Order.findOne({ checkoutKey });
      if (existing) return respondToRetry(existing, checkoutRequestHash, req, res);
    }
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, error: error.message });
    return next(error);
  }
};
module.exports = { createOrder };

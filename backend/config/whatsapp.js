const getWhatsappPhone = () => {
  const phone = (process.env.WHATSAPP_BUSINESS_PHONE || '').trim();
  if (!/^\d{8,15}$/.test(phone)) {
    const error = new Error('WhatsApp no está configurado. Contacta con la tienda por otro medio.');
    error.statusCode = 503;
    throw error;
  }
  return phone;
};

const buildWhatsappOrderUrl = (order, buyer = {}) => {
  const message = [
    'Hola, quiero completar este pedido de TechStore:',
    `Pedido: ${order._id}`,
    `Nombre: ${order.guestInfo?.name || buyer.name || 'Cliente'}`,
    `Correo: ${order.guestInfo?.email || buyer.email || 'No proporcionado'}`,
    ...order.items.map(
      (item) =>
        `• ${item.productName} x${item.quantity} — $${(item.price * item.quantity).toFixed(2)}`,
    ),
    `Subtotal: $${order.subtotalAmount.toFixed(2)}`,
    ...(order.discountAmount > 0 ? [`Descuento: -$${order.discountAmount.toFixed(2)}`] : []),
    `Total: $${order.totalAmount.toFixed(2)}`,
    'Por favor, confírmame disponibilidad y cómo finalizar la compra.',
  ].join('\n');
  return `https://wa.me/${getWhatsappPhone()}?text=${encodeURIComponent(message)}`;
};

module.exports = { getWhatsappPhone, buildWhatsappOrderUrl };

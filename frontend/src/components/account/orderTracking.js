import { requestJson } from '../../services/api.js';

export const orderPaymentLabel = (order) =>
  order.paymentStatus === 'paid'
    ? 'Pago confirmado'
    : order.status === 'cancelled' || order.expired || order.paymentStatus === 'failed'
      ? 'Sin pago confirmado'
      : 'Pendiente de confirmación';

export function orderShippingLabel(order) {
  if (order.expired) return 'Vencido';
  if (order.status === 'cancelled') return 'Cancelado';
  if (order.paymentStatus !== 'paid') return 'Pendiente de pago';
  return (
    {
      processing: 'En preparación',
      shipped: 'Enviado',
      delivered: 'Entregado',
      completed: 'Completado',
    }[order.status] || 'Pendiente de preparación'
  );
}

const eventLabels = {
  contact_confirmed: 'La tienda recibió el contacto por WhatsApp',
  payment_confirmed: 'Pago confirmado por la tienda',
  processing: 'Pedido en preparación',
  shipped: 'Pedido enviado',
  delivered: 'Pedido entregado',
  completed: 'Pedido completado',
  cancelled: 'Pedido cancelado por la tienda',
  customer_cancelled: 'Cancelaste el pedido',
  expired: 'La reserva del pedido venció',
};
export const orderEventLabel = (type) => eventLabels[type] || null;

export async function requestOrderUpdate(action, orderId, checkoutKey, request = requestJson) {
  const result = await request(`/api/orders/${action === 'cancel' ? 'cancel' : 'track'}`, {
    method: 'POST',
    body: JSON.stringify({ orderId, ...(checkoutKey ? { checkoutKey } : {}) }),
  });
  return result.data;
}

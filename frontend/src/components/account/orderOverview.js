export const isPreviousOrder = (order) => Boolean(order.expired) ||
  ['cancelled', 'delivered', 'completed'].includes(order.status) || order.paymentStatus === 'failed';

export function orderNextStep(order) {
  if (order.expired) return 'La reserva venció. Contacta con la tienda antes de volver a comprar.';
  if (order.status === 'cancelled') return 'Pedido cancelado. Puedes revisar el detalle y sus fechas.';
  if (['delivered', 'completed'].includes(order.status)) return 'Pedido finalizado. Conserva su referencia para cualquier consulta.';
  if (order.paymentStatus === 'failed') return 'No hay un pago confirmado. Contacta con la tienda para revisar el pedido.';
  if (order.paymentStatus === 'paid') return order.status === 'shipped'
    ? 'Tu pedido está enviado. Revisa el seguimiento o consulta con la tienda.'
    : 'Pago confirmado. La tienda está coordinando la preparación de tu pedido.';
  return order.contactConfirmedAt
    ? 'La tienda recibió el contacto. Espera la confirmación de disponibilidad y pago por WhatsApp.'
    : 'Si aún no lo hiciste, envía el mensaje por WhatsApp. Abrir WhatsApp no confirma el envío ni el pago.';
}

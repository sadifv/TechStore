import { useState } from 'react';
import { getOrderItemName } from '../account/orderItemDisplay.js';
import OrderAddress from '../account/OrderAddress.jsx';
import { AdminNotice } from './AdminNotice.jsx';
import { adminMutation } from '../../services/adminMutation.js';
import { date, money } from '../../utils/formatters.js';
import { OrderStatusSelect } from './OrderStatusSelect.jsx';
import { useAdminData } from '../../hooks/useAdminData.js';
const eventLabels = {
  inventory_product_missing: 'Producto eliminado previamente; revisar referencia de inventario',
  created: 'Pedido creado',
  contact_confirmed: 'Contacto por WhatsApp recibido',
  payment_confirmed: 'Pago confirmado; preparación iniciada',
  cancelled: 'Cancelado por la tienda',
  expired: 'Reserva vencida',
  checkout_failed: 'Pedido fallido',
  processing: 'En preparación',
  shipped: 'Enviado',
  delivered: 'Entregado',
  completed: 'Completado',
};

export function AdminOrderDetailPage({ orderId }) {
  const { data, error, refresh } = useAdminData(`/api/admin/orders/${encodeURIComponent(orderId)}`);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const order = data?.order;
  const recordAction = async (action, message) => {
    setConfirmingPayment(true);
    setPaymentMessage('');
    try {
      await adminMutation(`/api/admin/orders/${orderId}/${action}`, { method: 'POST' });
      setPaymentMessage(message);
      refresh();
    } catch (mutationError) {
      setPaymentMessage(mutationError.message);
    } finally {
      setConfirmingPayment(false);
    }
  };
  if (error) return <AdminNotice error={error} />;
  if (!order)
    return (
      <section className="admin-container container">
        <p role="status">Cargando orden…</p>
      </section>
    );
  return (
    <section className="admin-container container order-detail-page">
      <header className="admin-header">
        <div>
          <a href="/admin/orders" className="btn btn-outline btn-sm">
            ← Volver a Órdenes
          </a>
          <h1>Detalle de Orden #{order._id}</h1>
        </div>
        <a
          href={`/admin/orders/${order._id}/packing-slip`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary"
          onClick={(event) => {
            event.preventDefault();
            window.open(`/admin/orders/${order._id}/packing-slip`, '_blank', 'noopener');
          }}
        >
          Imprimir Packing Slip
        </a>
      </header>
      <div className="order-detail-grid">
        <article className="order-card">
          <h2>Información del Cliente</h2>
          <p>
            <strong>Nombre:</strong>{' '}
            {order.user?.name || order.guestInfo?.name || 'Sin información'}
          </p>
          <p>
            <strong>Email:</strong> {order.user?.email || order.guestInfo?.email || '—'}
          </p>
          <p>
            <strong>Fecha de Orden:</strong>{' '}
            {date(order.createdAt, { dateStyle: 'long', timeStyle: 'short' })}
          </p>
        </article>
        <article className="order-card">
          <OrderAddress order={order} />
          <h2>Estado del Pedido</h2>
          <p>
            {order.paymentStatus === 'paid'
              ? 'Pago confirmado; pedido en proceso de entrega.'
              : order.paymentStatus === 'failed'
                ? 'Pedido cancelado o vencido.'
                : order.contactConfirmedAt
                  ? 'Contacto recibido; esperando pago.'
                  : 'Esperando contacto por WhatsApp.'}
          </p>
          {order.paymentMethod === 'whatsapp' && order.paymentStatus === 'pending' && (
            <>
              {!order.contactConfirmedAt && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={confirmingPayment}
                  onClick={() => recordAction('confirm-contact', 'Contacto registrado.')}
                >
                  Registrar contacto recibido
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline"
                disabled={confirmingPayment}
                onClick={() => recordAction('cancel', 'Pedido cancelado; inventario liberado.')}
              >
                Cancelar pedido sin pago
              </button>
              <p>Confirma el pago solo después de verificarlo directamente con el cliente.</p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={confirmingPayment}
                onClick={async () => {
                  setConfirmingPayment(true);
                  setPaymentMessage('');
                  try {
                    await adminMutation(`/api/admin/orders/${order._id}/confirm-payment`, {
                      method: 'POST',
                    });
                    setPaymentMessage('Pago confirmado; el pedido pasó a preparación.');
                    refresh();
                  } catch (mutationError) {
                    setPaymentMessage(mutationError.message);
                  } finally {
                    setConfirmingPayment(false);
                  }
                }}
              >
                {confirmingPayment ? 'Confirmando…' : 'Confirmar pago recibido'}
              </button>
            </>
          )}
          {paymentMessage && <p role="status">{paymentMessage}</p>}
          <OrderStatusSelect order={order} onUpdated={refresh} />
          <h3>Historial del pedido</h3>
          <ol>
            {(order.events || []).map((event, index) => (
              <li key={index}>
                {eventLabels[event.type] || event.type} —{' '}
                {date(event.at, { dateStyle: 'medium', timeStyle: 'short' })}
                {event.actor
                  ? ` · Responsable: ${event.actor.name || event.actor}`
                  : ' · Sistema / cliente'}
              </li>
            ))}
          </ol>
        </article>
      </div>
      <section className="order-items-section">
        <h2>Productos Comprados</h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Precio Unitario</th>
                <th>Cantidad</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={`${item._id || index}`}>
                  <td>{getOrderItemName(item)}</td>
                  <td>{money(item.price)}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan="3">Total General:</th>
                <td>
                  <strong>{money(order.totalAmount)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { requestJson } from '../../api.js';
import { getOrderItemName } from './orderItemDisplay.js';
import { formatCurrency } from './utils.js';

export function ProfilePage({ user }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    requestJson('/api/orders')
      .then((result) => {
        if (!active) return;
        setOrders(result.orders || []);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="container profile-container" aria-labelledby="profile-heading">
      <section className="profile-card">
        <figure className="profile-avatar">
          <i className="ri-user-3-line" aria-hidden="true" />
        </figure>
        <article className="profile-details">
          <h1 id="profile-heading">Mi Cuenta</h1>
          <p>
            <strong>Nombre:</strong> {user?.name || 'Usuario'}
          </p>
          <p>
            <strong>Correo:</strong> {user?.email || '—'}
          </p>
        </article>
      </section>
      <section className="orders-section">
        <h2>Historial de Compras</h2>
        {orders === null && !error && <p className="orders-status">Cargando tus pedidos…</p>}
        {error && (
          <p className="orders-status error" role="status">
            {error}
          </p>
        )}
        {orders?.length === 0 && <p className="empty-msg">Aún no has realizado ninguna compra.</p>}
        <ul className="orders-list">
          {orders?.map((order) => {
            const total =
              order.totalAmount ??
              order.total ??
              (order.items || []).reduce(
                (sum, item) =>
                  sum + Number(item.price ?? item.product?.price ?? 0) * Number(item.quantity || 1),
                0,
              );
            return (
              <li key={order._id}><article className="order-card">
                <header className="order-header">
                  <section aria-label="Referencia del pedido">
                    <h3 className="order-id">Orden #{String(order._id).slice(0, 8)}</h3>
                    <time className="order-date" dateTime={order.createdAt}>
                      {new Date(order.createdAt).toLocaleDateString('es-EC', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                  </section>
                  <span className={`order-status status-${order.status || 'completed'}`}>
                    {order.status === 'pending'
                      ? 'Pendiente'
                      : order.paymentStatus === 'paid'
                        ? 'Pagado'
                        : order.status || 'Procesado'}
                  </span>
                </header>
                <ul className="order-body">
                  {(order.items || []).map((item, index) => (
                    <li
                      className="order-item"
                      key={`${item.product?._id || item.product || index}-${index}`}
                    >
                      <span>
                        {getOrderItemName(item)} (×{item.quantity || 1})
                      </span>
                      <span>
                        {formatCurrency(
                          Number(item.price ?? item.product?.price ?? 0) *
                            Number(item.quantity || 1),
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <footer className="order-footer">
                  <span>
                    Método: <strong>{order.paymentMethod || 'Tarjeta'}</strong>
                  </span>
                  <span className="order-total">
                    Total: <strong>{formatCurrency(total)}</strong>
                  </span>
                </footer>
              </article></li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}

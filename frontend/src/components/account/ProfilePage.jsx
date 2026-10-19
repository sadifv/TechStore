import { useEffect, useState } from 'react';
import { requestJson } from '../../api.js';
import { formatCurrency } from './utils.js';

export function MembershipSummary({ membership }) {
  if (!membership) return <p className="membership-status">Aún no tienes una membresía activa.</p>;
  const endDate = membership.currentPeriodEnd
    ? new Date(membership.currentPeriodEnd).toLocaleDateString('es-EC')
    : null;
  const label =
    membership.status === 'active'
      ? `Activa hasta el ${endDate || 'fin del período'}.${membership.cancelAtPeriodEnd ? ' La cancelación ya está programada.' : ''}`
      : membership.status === 'pending'
        ? 'Tu pago está pendiente de confirmación.'
        : membership.status === 'past_due'
          ? 'Hay un pago pendiente en tu membresía.'
          : 'Tu membresía no está activa.';
  return (
    <>
      <p className="membership-status">{label}</p>
      <div className="membership-coupons">
        {membership.welcomeCouponCode && (
          <p>
            Cupón de bienvenida: <strong>{membership.welcomeCouponCode}</strong>
          </p>
        )}
        {membership.monthlyCouponCode && (
          <p>
            Cupón VIP mensual: <strong>{membership.monthlyCouponCode}</strong>
          </p>
        )}
      </div>
    </>
  );
}

export function ProfilePage({ user }) {
  const [orders, setOrders] = useState(null);
  const [membership, setMembership] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.allSettled([requestJson('/api/orders'), requestJson('/api/membership')]).then(
      ([orderResult, membershipResult]) => {
        if (!active) return;
        if (orderResult.status === 'fulfilled') setOrders(orderResult.value.orders || []);
        else setError(orderResult.reason.message);
        if (membershipResult.status === 'fulfilled')
          setMembership(membershipResult.value.membership);
        else
          setError((current) =>
            current
              ? `${current} ${membershipResult.reason.message}`
              : membershipResult.reason.message,
          );
      },
    );
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
      <section
        className="membership-card profile-membership-card"
        aria-labelledby="profile-membership-heading"
      >
        <h2 id="profile-membership-heading">Membresía VIP</h2>
        <MembershipSummary membership={membership} />
        {error && (
          <p className="form-status error" role="status">
            {error}
          </p>
        )}
        <a href="/vip" className="btn btn-outline">
          Ver planes y beneficios
        </a>
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
        <div className="orders-list">
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
              <article className="order-card" key={order._id}>
                <header className="order-header">
                  <hgroup>
                    <strong className="order-id">Orden #{String(order._id).slice(0, 8)}</strong>
                    <time className="order-date" dateTime={order.createdAt}>
                      {new Date(order.createdAt).toLocaleDateString('es-EC', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                  </hgroup>
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
                        {item.product?.name || item.name || 'Producto'} (×{item.quantity || 1})
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
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

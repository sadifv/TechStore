import { useEffect, useRef, useState } from 'react';
import { requestJson } from '../../services/api.js';
import { isPreviousOrder } from './orderOverview.js';
import ProfileOrderCard from './ProfileOrderCard.jsx';

export default function ProfileOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const previousHeading = useRef(null);
  useEffect(() => {
    let active = true;
    requestJson('/api/orders').then((result) => {
      if (active) setOrders(result.orders || []);
    }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [attempt]);
  function update(updated) {
    const before = orders.find((order) => order._id === updated._id);
    setOrders((current) => current.map((order) => order._id === updated._id ? updated : order));
    if (updated.status === 'cancelled' && before?.status !== 'cancelled') setMessage('Tu pedido se canceló correctamente.');
    if (before && !isPreviousOrder(before) && isPreviousOrder(updated)) {
      requestAnimationFrame(() => previousHeading.current?.focus());
    }
  }
  return (
    <section className="orders-section" id="profile-orders" aria-labelledby="profile-orders-heading">
      <h2 id="profile-orders-heading">Mis pedidos</h2>
      {orders === null && !error && <p role="status">Cargando tus pedidos…</p>}
      {error && <section aria-label="Error al cargar pedidos">
        <p className="form-status error" role="alert">{error}</p>
        <button type="button" className="btn btn-outline" onClick={() => { setError(''); setAttempt((value) => value + 1); }}>Reintentar carga</button>
      </section>}
      {message && <p role="status">{message}</p>}
      {orders?.length === 0 && <p>Aún no has realizado ninguna compra.</p>}
      {orders?.length > 0 && [false, true].map((previous) => {
        const group = orders.filter((order) => isPreviousOrder(order) === previous);
        const id = previous ? 'previous-orders' : 'active-orders';
        return <section className="profile-order-group" aria-labelledby={id} key={id}>
          <h3 id={id} ref={previous ? previousHeading : undefined} tabIndex={previous ? -1 : undefined}>{previous ? 'Anteriores' : 'Activos'} ({group.length})</h3>
          {!group.length && <p>{previous ? 'Aún no tienes pedidos anteriores.' : 'No tienes pedidos activos.'}</p>}
          <ul className="orders-list">
            {group.map((order) => <li key={order._id}><ProfileOrderCard order={order} onUpdate={update} /></li>)}
          </ul>
        </section>;
      })}
    </section>
  );
}

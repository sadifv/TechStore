import { useState } from 'react';
import {
  AdminNotice,
  AdminPagination,
  adminMutation,
  date,
  money,
  OrderStatusSelect,
  useAdminData,
} from './shared.jsx';

export function AdminOrdersPage() {
  const params = new URLSearchParams(location.search);
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const [status, setStatus] = useState(params.get('status') || '');
  const { data, error } = useAdminData(
    `/api/admin/orders?page=${page}&status=${encodeURIComponent(status)}`,
  );
  if (error) return <AdminNotice error={error} />;
  if (!data)
    return (
      <section className="admin-container container">
        <p role="status">Cargando órdenes…</p>
      </section>
    );
  const filters = [
    ['', 'Todas'],
    ['pending', 'Pendientes'],
    ['processing', 'En proceso'],
    ['shipped', 'Enviadas'],
    ['completed', 'Completadas'],
    ['cancelled', 'Canceladas'],
  ];
  return (
    <section className="admin-container container admin-orders-page">
      <header className="admin-header">
        <h1>
          <i className="ri-shopping-bag-line" /> Gestión de Órdenes
        </h1>
        <nav className="admin-filter-nav" aria-label="Filtro de estados">
          {filters.map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`btn btn-sm ${status === value ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID Orden</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Pago</th>
              <th>Envío</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.map((order) => (
              <tr key={order._id}>
                <td>
                  <code>#{order._id}</code>
                </td>
                <td>
                  <strong>
                    {order.user?.name || order.guestInfo?.name || 'Cliente desconocido'}
                  </strong>
                  <br />
                  <small>{order.user?.email || order.guestInfo?.email}</small>
                </td>
                <td>{date(order.createdAt)}</td>
                <td>
                  <strong>{money(order.totalAmount)}</strong>
                </td>
                <td>
                  <span
                    className={`badge badge-${order.paymentStatus === 'paid' ? 'success' : 'warning'}`}
                  >
                    {order.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente'}
                  </span>
                </td>
                <td>
                  <OrderStatusSelect order={order} />
                </td>
                <td>
                  <a href={`/admin/orders/${order._id}`} className="btn btn-sm btn-secondary">
                    Detalle
                  </a>
                </td>
              </tr>
            ))}
            {!data.orders.length && (
              <tr>
                <td colSpan="7">No se encontraron órdenes registradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AdminPagination pagination={data.pagination} onPage={setPage} />
    </section>
  );
}

export function AdminOrderDetailPage({ orderId }) {
  const { data, error, refresh } = useAdminData(`/api/admin/orders/${encodeURIComponent(orderId)}`);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const order = data?.order;
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
          <h2>Estado del Pedido</h2>
          {order.paymentMethod === 'whatsapp' && order.paymentStatus === 'pending' && (
            <>
              <p>Confirma el pago solo después de verificarlo directamente con el cliente.</p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={confirmingPayment}
                onClick={async () => {
                  setConfirmingPayment(true);
                  setPaymentMessage('');
                  try {
                    await adminMutation(`/admin/orders/${order._id}/confirm-payment`, {
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
              {paymentMessage && <p role="status">{paymentMessage}</p>}
            </>
          )}
          <OrderStatusSelect order={order} onUpdated={refresh} />
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
                  <td>{item.product?.name || <em>Producto no disponible o eliminado</em>}</td>
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

export function AdminPackingSlipPage({ orderId }) {
  const { data, error } = useAdminData(
    `/api/admin/orders/${encodeURIComponent(orderId)}/packing-slip`,
  );
  const order = data?.order;
  if (error) return <AdminNotice error={error} />;
  if (!order)
    return (
      <main className="container">
        <p role="status">Preparando comprobante…</p>
      </main>
    );
  return (
    <main className="packing-slip">
      <div className="packing-main">
        <header className="packing-header">
          <p className="packing-logo">TechStore</p>
          <h1 className="packing-doc-title">
            Packing Slip #{String(order._id).slice(-8).toUpperCase()}
          </h1>
          <button className="btn btn-primary no-print" type="button" onClick={() => window.print()}>
            Imprimir
          </button>
        </header>
        <section className="packing-section" aria-labelledby="packing-customer-heading">
          <h2 id="packing-customer-heading" className="packing-section-title">
            Información del Cliente
          </h2>
          <dl className="packing-info-list">
            <div className="packing-info-row">
              <dt className="packing-info-label">Nombre:</dt>
              <dd className="packing-info-value">
                {order.guestInfo?.name || order.user?.name || 'N/A'}
              </dd>
            </div>
            <div className="packing-info-row">
              <dt className="packing-info-label">Email:</dt>
              <dd className="packing-info-value">
                {order.guestInfo?.email || order.user?.email || 'N/A'}
              </dd>
            </div>
            <div className="packing-info-row">
              <dt className="packing-info-label">Dirección:</dt>
              <dd className="packing-info-value">
                {order.shippingAddress?.street || 'Dirección estándar'},{' '}
                {order.shippingAddress?.city || 'Guayaquil'},{' '}
                {order.shippingAddress?.country || 'Ecuador'}
              </dd>
            </div>
          </dl>
        </section>
        <section className="packing-section" aria-labelledby="packing-order-heading">
          <h2 id="packing-order-heading" className="packing-section-title">
            Detalles del Pedido
          </h2>
          <dl className="packing-info-list">
            <div className="packing-info-row">
              <dt className="packing-info-label">Fecha:</dt>
              <dd className="packing-info-value">
                <time dateTime={new Date(order.createdAt).toISOString()}>
                  {date(order.createdAt)}
                </time>
              </dd>
            </div>
            <div className="packing-info-row">
              <dt className="packing-info-label">Estado:</dt>
              <dd className="packing-info-value">{order.status}</dd>
            </div>
            <div className="packing-info-row">
              <dt className="packing-info-label">Pago:</dt>
              <dd className="packing-info-value">{order.paymentStatus}</dd>
            </div>
          </dl>
        </section>
        <section className="packing-section" aria-labelledby="packing-products-heading">
          <h2 id="packing-products-heading" className="packing-section-title">
            Productos
          </h2>
          <table className="packing-table">
            <caption className="sr-only">Productos incluidos en la orden</caption>
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Precio Unit.</th>
                <th scope="col">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={item._id || index}>
                  <td>{item.product?.name || item.productName || 'Producto'}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.price)}</td>
                  <td>{money(Number(item.price) * Number(item.quantity))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="packing-total-row">
                <th scope="row" colSpan="3">
                  Total:
                </th>
                <td>
                  <strong>{money(order.totalAmount)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
        <footer className="packing-footer">
          <address>
            TechStore - Villa España, Guayaquil, Ecuador |{' '}
            <a href="tel:+593963976623">+593 0963976623</a>
          </address>
        </footer>
      </div>
    </main>
  );
}

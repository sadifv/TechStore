import { useState } from 'react';
import { AdminNotice } from './AdminNotice.jsx';
import { AdminPagination } from './AdminPagination.jsx';
import { date, money } from '../../utils/formatters.js';
import { OrderStatusSelect } from './OrderStatusSelect.jsx';
import { useAdminData } from '../../hooks/useAdminData.js';

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
                    {order.paymentStatus === 'paid'
                      ? 'Pagado'
                      : order.paymentStatus === 'failed'
                        ? 'Cancelado / vencido'
                        : order.contactConfirmedAt
                          ? 'Contacto recibido; pendiente de pago'
                          : 'Pendiente de contacto'}
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

import { backendAssetUrl } from '../../services/api.js';
import { date, money } from '../../utils/formatters.js';
import { placeholder, statuses } from '../../config/storeCatalog.js';

export function DashboardSalesOverview({ data, orders }) {
  return (
    <>
      <section className="dashboard-stats" aria-label="Resumen de ventas">
        {[
          ['Órdenes Totales', data.totalOrders],
          ['Ingresos Pagados', money(data.totalRevenue)],
          ['Productos Vendidos', data.totalProductsSold],
          ['Carritos Activos', data.activeCartCount],
        ].map(([label, value]) => (
          <article className="stat-card" key={label}>
            <h3>{label}</h3>
            <p className="stat-number">{value ?? 0}</p>
          </article>
        ))}
      </section>
      <section className="dashboard-orders">
        <header className="section-heading">
          <h2 className="section-title">Órdenes recientes</h2>
          <a href="/admin/orders" className="btn btn-sm btn-outline">
            Ver todas
          </a>
        </header>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={order._id}>
                  <td>{index + 1}</td>
                  <td>
                    {order.user?.name || order.guestInfo?.name || 'Invitado'}
                    <small>{order.user?.email || order.guestInfo?.email}</small>
                  </td>
                  <td>{money(order.totalAmount)}</td>
                  <td>
                    <span className={`status-${order.status}`}>
                      {statuses[order.status] || order.status}
                    </span>
                  </td>
                  <td>{date(order.createdAt)}</td>
                  <td>
                    <a href={`/admin/orders/${order._id}`} className="btn btn-sm btn-primary">
                      Ver
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function DashboardTopProducts({ topProducts }) {
  return (
    <section className="dashboard-products">
      <h2 className="section-title">Productos más vendidos</h2>
      <div className="products-grid">
        {topProducts.map((item) => (
          <article className="product-card" key={item._id}>
            <a href={`/producto/${item._id}`}>
              <img src={backendAssetUrl(item.image || placeholder)} alt={item.name} />
              <h4>{item.name}</h4>
            </a>
            <p className="product-price">{money(item.price)}</p>
            <small>{item.unitsSold} vendidos</small>
          </article>
        ))}
        {!topProducts.length && <p className="empty-msg">Todavía no hay productos vendidos.</p>}
      </div>
    </section>
  );
}

import { useState } from 'react';
import AppearanceSettings from './AppearanceSettings.jsx';
import { AdminNotice } from './AdminNotice.jsx';
import { useAdminData } from '../../hooks/useAdminData.js';
import DashboardCatalog from './DashboardCatalog.jsx';
import DashboardContacts from './DashboardContacts.jsx';
import { DashboardSalesOverview, DashboardTopProducts } from './DashboardSales.jsx';

export function AdminDashboardPage({ user }) {
  const [subscriberPage, setSubscriberPage] = useState(1);
  const { data, error, refresh } = useAdminData(
    `/api/admin/dashboard?subscribersPage=${subscriberPage}`,
  );
  if (error) return <AdminNotice error={error} />;
  if (!data)
    return (
      <section className="admin-container container">
        <p role="status">Cargando panel…</p>
      </section>
    );
  const {
    orders = [],
    products = [],
    topProducts = [],
    messages = [],
    subscribers = [],
    subscriberPagination,
  } = data;
  return (
    <section className="admin-container container" aria-labelledby="admin-dashboard-heading">
      {user?.role === 'owner' && <AppearanceSettings />}
      <header className="admin-header">
        <h1 id="admin-dashboard-heading">
          <i className="ri-dashboard-line" /> Panel de Administración
        </h1>
        <nav className="admin-header-actions" aria-label="Gestión de administración">
          <a href="/admin/users" className="btn btn-outline">
            Usuarios
          </a>
          <a href="/admin/reviews" className="btn btn-outline">
            Moderar reseñas
          </a>
          <a href="/admin/marketing" className="btn btn-primary">
            Marketing y cupones
          </a>
        </nav>
      </header>
      <DashboardSalesOverview data={data} orders={orders} />
      <DashboardCatalog products={products} refresh={refresh} />
      <DashboardContacts
        messages={messages}
        subscribers={subscribers}
        subscriberPagination={subscriberPagination}
        setSubscriberPage={setSubscriberPage}
        refresh={refresh}
      />
      <DashboardTopProducts topProducts={topProducts} />
    </section>
  );
}

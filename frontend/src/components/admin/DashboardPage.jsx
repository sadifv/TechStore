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
  const { orders = [], topProducts = [], subscribers = [], subscriberPagination } = data;
  return (
    <section className="admin-container container" aria-labelledby="admin-dashboard-heading">
      {user?.role === 'owner' && <AppearanceSettings />}
      <header className="admin-header dashboard-header">
        <h1 id="admin-dashboard-heading">
          <i aria-hidden="true" className="ri-dashboard-line" /> Panel de Administración
        </h1>
      </header>
      <DashboardSalesOverview data={data} orders={orders} />
      <DashboardCatalog refresh={refresh} />
      <DashboardContacts
        subscribers={subscribers}
        subscriberPagination={subscriberPagination}
        setSubscriberPage={setSubscriberPage}
        refresh={refresh}
      />
      <DashboardTopProducts topProducts={topProducts} />
    </section>
  );
}

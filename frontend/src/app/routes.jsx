import { lazy } from 'react';
import AccountAccess from '../components/account/AccountAccess.jsx';
import HomePage from '../pages/HomePage.jsx';
import NewsletterUnsubscribePage from '../components/marketing/NewsletterUnsubscribePage.jsx';
const RestockPreferencePage = lazy(() => import('../components/catalog/RestockPreferencePage.jsx'));
const CatalogPage = lazy(() => import('../pages/CatalogPage.jsx'));
const ProductPage = lazy(() => import('../pages/ProductPage.jsx'));
const ReviewModerationPage = lazy(() => import('../components/admin/ReviewModerationPage.jsx'));
const LoginPage = lazy(() =>
  import('../components/account/LoginPage.jsx').then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('../components/account/RegisterPage.jsx').then((module) => ({
    default: module.RegisterPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import('../components/account/ForgotPasswordPage.jsx').then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import('../components/account/ResetPasswordPage.jsx').then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const ProfilePage = lazy(() =>
  import('../components/account/ProfilePage.jsx').then((module) => ({
    default: module.ProfilePage,
  })),
);
const LegalPage = lazy(() =>
  import('../components/account/LegalPage.jsx').then((module) => ({ default: module.LegalPage })),
);
const CheckoutSuccessPage = lazy(() =>
  import('../components/admin/CheckoutSuccessPage.jsx').then((module) => ({
    default: module.CheckoutSuccessPage,
  })),
);
const AdminDashboardPage = lazy(() =>
  import('../components/admin/DashboardPage.jsx').then((module) => ({
    default: module.AdminDashboardPage,
  })),
);
const AdminMarketingPage = lazy(() =>
  import('../components/admin/MarketingPage.jsx').then((module) => ({
    default: module.AdminMarketingPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import('../components/admin/UsersPage.jsx').then((module) => ({
    default: module.AdminUsersPage,
  })),
);
const AdminOrdersPage = lazy(() =>
  import('../components/admin/OrdersPage.jsx').then((module) => ({
    default: module.AdminOrdersPage,
  })),
);
const AdminOrderDetailPage = lazy(() =>
  import('../components/admin/OrderDetailPage.jsx').then((module) => ({
    default: module.AdminOrderDetailPage,
  })),
);
const AdminPackingSlipPage = lazy(() =>
  import('../components/admin/PackingSlipPage.jsx').then((module) => ({
    default: module.AdminPackingSlipPage,
  })),
);

export function PageLoading() {
  return (
    <p className="products-section" role="status">
      Cargando página…
    </p>
  );
}

function NotFoundPage() {
  return (
    <section className="products-section">
      <h1>Página no encontrada</h1>
      <a className="btn btn-primary" href="/">
        Volver al inicio
      </a>
    </section>
  );
}

function ErrorPage() {
  return (
    <section className="error-page container">
      <h1>Ocurrió un error</h1>
      <p>No pudimos completar tu solicitud. Inténtalo de nuevo.</p>
      <a className="btn btn-primary" href="/">
        Volver al inicio
      </a>
    </section>
  );
}

const pages = {
  home: ({ user }) => <HomePage user={user} />,
  catalog: () => <CatalogPage />,
  product: ({ user, parameter }) => <ProductPage productId={parameter} user={user} />,
  login: () => <LoginPage />,
  register: () => <RegisterPage />,
  profile: ({ user, authReady }) => (
    <AccountAccess user={user} ready={authReady}>
      <ProfilePage user={user} />
    </AccountAccess>
  ),
  restock: () => <RestockPreferencePage />,
  legal: () => <LegalPage />,
  forgot: () => <ForgotPasswordPage />,
  reset: ({ parameter }) => <ResetPasswordPage token={parameter} />,
  unsubscribe: () => <NewsletterUnsubscribePage />,
  checkout: () => <CheckoutSuccessPage />,
  error: () => <ErrorPage />,
  dashboard: ({ user }) => <AdminDashboardPage user={user} />,
  marketing: () => <AdminMarketingPage />,
  orders: () => <AdminOrdersPage />,
  packing: ({ parameter }) => <AdminPackingSlipPage orderId={parameter} />,
  order: ({ parameter }) => <AdminOrderDetailPage orderId={parameter} />,
  users: () => <AdminUsersPage />,
  reviews: () => <ReviewModerationPage />,
  notFound: () => <NotFoundPage />,
};
export function RoutedPage({ route, user, authReady }) {
  return pages[route.name]({ user, authReady, parameter: route.parameter });
}

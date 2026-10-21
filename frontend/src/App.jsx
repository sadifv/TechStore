import { lazy, Suspense, useEffect, useState } from 'react';
import { requestJson } from './api.js';
import { CartProvider } from './components/Cart.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import SiteHeader from './components/SiteHeader.jsx';
import NewsletterUnsubscribePage from './components/NewsletterUnsubscribePage.jsx';
import HomePage from './pages/HomePage.jsx';
import { decodeRouteSegment } from './routeSegments.js';
import usePresenceHeartbeat from './hooks/usePresenceHeartbeat.js';

const CatalogPage = lazy(() => import('./pages/CatalogPage.jsx'));
const ProductPage = lazy(() => import('./pages/ProductPage.jsx'));
const LoginPage = lazy(() =>
  import('./components/account/AuthPages.jsx').then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('./components/account/AuthPages.jsx').then((module) => ({ default: module.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('./components/account/AuthPages.jsx').then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import('./components/account/AuthPages.jsx').then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const ProfilePage = lazy(() =>
  import('./components/account/ProfilePage.jsx').then((module) => ({
    default: module.ProfilePage,
  })),
);
const LegalPage = lazy(() =>
  import('./components/account/LegalPage.jsx').then((module) => ({ default: module.LegalPage })),
);
const CheckoutSuccessPage = lazy(() =>
  import('./components/admin/CheckoutSuccessPage.jsx').then((module) => ({
    default: module.CheckoutSuccessPage,
  })),
);
const AdminDashboardPage = lazy(() =>
  import('./components/admin/DashboardPage.jsx').then((module) => ({
    default: module.AdminDashboardPage,
  })),
);
const AdminMarketingPage = lazy(() =>
  import('./components/admin/UserMarketingPages.jsx').then((module) => ({
    default: module.AdminMarketingPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import('./components/admin/UserMarketingPages.jsx').then((module) => ({
    default: module.AdminUsersPage,
  })),
);
const AdminOrdersPage = lazy(() =>
  import('./components/admin/OrderPages.jsx').then((module) => ({
    default: module.AdminOrdersPage,
  })),
);
const AdminOrderDetailPage = lazy(() =>
  import('./components/admin/OrderPages.jsx').then((module) => ({
    default: module.AdminOrderDetailPage,
  })),
);
const AdminPackingSlipPage = lazy(() =>
  import('./components/admin/OrderPages.jsx').then((module) => ({
    default: module.AdminPackingSlipPage,
  })),
);

function PageLoading() {
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

export default function App() {
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  usePresenceHeartbeat(authReady ? user : null);
  useEffect(() => {
    requestJson('/api/auth/me')
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));
  }, []);

  const productMatch = pathname.match(/^\/producto\/([^/]+)$/);
  const resetMatch = pathname.match(/^\/reset-password\/([^/]+)$/);
  const unsubscribeMatch = pathname.match(/^\/(?:api\/)?newsletter\/unsubscribe\/([^/]+)$/);
  const orderDetailMatch = pathname.match(/^\/admin\/orders\/([^/]+)$/);
  const packingSlipMatch = pathname.match(/^\/admin\/orders\/([^/]+)\/packing-slip$/);
  const malformedRoute = [productMatch, resetMatch, orderDetailMatch, packingSlipMatch, unsubscribeMatch].some((match) => match && decodeRouteSegment(match[1]) === null);
  let page;
  if (malformedRoute) page = <NotFoundPage />;
  else if (pathname === '/') page = <HomePage user={user} />;
  else if (pathname === '/catalogo') page = <CatalogPage />;
  else if (productMatch) page = <ProductPage productId={decodeRouteSegment(productMatch[1])} />;
  else if (pathname === '/login') page = <LoginPage />;
  else if (pathname === '/register') page = <RegisterPage />;
  else if (pathname === '/profile')
    page = authReady ? (
      user ? (
        <ProfilePage user={user} />
      ) : (
        <section className="products-section">
          <h1>Inicia sesión para ver tu cuenta</h1>
          <a className="btn btn-primary" href="/login?next=%2Fprofile">
            Iniciar sesión
          </a>
        </section>
      )
    ) : (
      <section className="products-section">
        <p role="status">Cargando tu cuenta…</p>
      </section>
    );
  else if (pathname === '/legal') page = <LegalPage />;
  else if (pathname === '/forgot-password') page = <ForgotPasswordPage />;
  else if (resetMatch) page = <ResetPasswordPage token={decodeRouteSegment(resetMatch[1])} />;
  else if (
    unsubscribeMatch ||
    pathname === '/api/marketing/unsubscribe' ||
    pathname === '/marketing/unsubscribe'
  )
    page = <NewsletterUnsubscribePage />;
  else if (pathname === '/pedido-enviado') page = <CheckoutSuccessPage />;
  else if (pathname === '/error') page = <ErrorPage />;
  else if (pathname === '/admin' || pathname === '/admin/dashboard') page = <AdminDashboardPage />;
  else if (pathname === '/admin/marketing') page = <AdminMarketingPage />;
  else if (pathname === '/admin/orders') page = <AdminOrdersPage />;
  else if (packingSlipMatch)
    page = <AdminPackingSlipPage orderId={decodeRouteSegment(packingSlipMatch[1])} />;
  else if (orderDetailMatch)
    page = <AdminOrderDetailPage orderId={decodeRouteSegment(orderDetailMatch[1])} />;
  else if (pathname === '/admin/users') page = <AdminUsersPage />;
  else page = <NotFoundPage />;

  if (packingSlipMatch) return <Suspense fallback={<PageLoading />}>{page}</Suspense>;
  return (
    <CartProvider user={user}>
      <a className="skip-link" href="#main-content">
        Saltar al contenido principal
      </a>
      <SiteHeader user={user} />
      <main id="main-content" className="main-content">
        <Suspense fallback={<PageLoading />}>{page}</Suspense>
      </main>
      <SiteFooter />
    </CartProvider>
  );
}

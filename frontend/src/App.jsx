import { useEffect, useState } from 'react';
import { requestJson } from './api.js';
import {
  ForgotPasswordPage,
  LegalPage,
  LoginPage,
  ProfilePage,
  RegisterPage,
  ResetPasswordPage,
} from './components/AccountPages.jsx';
import { CartProvider } from './components/Cart.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import SiteHeader from './components/SiteHeader.jsx';
import {
  AdminDashboardPage,
  AdminMarketingPage,
  AdminOrderDetailPage,
  AdminOrdersPage,
  AdminPackingSlipPage,
  AdminUsersPage,
  CheckoutSuccessPage,
} from './components/AdminPages.jsx';
import NewsletterUnsubscribePage from './components/NewsletterUnsubscribePage.jsx';
import HomePage from './pages/HomePage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import usePresenceHeartbeat from './hooks/usePresenceHeartbeat.js';

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
  let page;
  if (pathname === '/') page = <HomePage user={user} />;
  else if (pathname === '/catalogo') page = <CatalogPage />;
  else if (productMatch) page = <ProductPage productId={decodeURIComponent(productMatch[1])} />;
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
  else if (resetMatch) page = <ResetPasswordPage token={decodeURIComponent(resetMatch[1])} />;
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
    page = <AdminPackingSlipPage orderId={decodeURIComponent(packingSlipMatch[1])} />;
  else if (orderDetailMatch)
    page = <AdminOrderDetailPage orderId={decodeURIComponent(orderDetailMatch[1])} />;
  else if (pathname === '/admin/users') page = <AdminUsersPage />;
  else page = <NotFoundPage />;

  if (packingSlipMatch) return page;
  return (
    <CartProvider user={user}>
      <a className="skip-link" href="#main-content">
        Saltar al contenido principal
      </a>
      <SiteHeader user={user} />
      <main id="main-content" className="main-content">
        {page}
      </main>
      <SiteFooter />
    </CartProvider>
  );
}

import { Suspense } from 'react';
import { CartProvider } from './components/cart/Cart.jsx';
import SiteFooter from './components/layout/SiteFooter.jsx';
import SiteHeader from './components/layout/SiteHeader.jsx';
import FavoritesProvider from './components/favorites/FavoritesProvider.jsx';
import SessionError from './components/account/SessionError.jsx';
import useSession from './hooks/useSession.js';
import useStoreTheme from './hooks/useStoreTheme.js';
import usePresenceHeartbeat from './hooks/usePresenceHeartbeat.js';
import { matchRoute } from './app/routeDefinitions.js';
import { RoutedPage, PageLoading } from './app/routes.jsx';

export default function App() {
  const { user, ready: authReady, error } = useSession();
  useStoreTheme();
  usePresenceHeartbeat(authReady ? user : null);
  if (error) return <SessionError error={error} />;
  const route = matchRoute(location.pathname);
  const page = (
    <Suspense fallback={<PageLoading />}>
      <RoutedPage route={route} user={user} authReady={authReady} />
    </Suspense>
  );
  if (route.standalone) return page;
  return (
    <CartProvider user={user}>
      <FavoritesProvider key={user?.id || 'guest'} user={user}>
        <a className="skip-link" href="#main-content">
          Saltar al contenido principal
        </a>
        <SiteHeader user={user} />
        <main id="main-content" className="main-content">
          {page}
        </main>
        <SiteFooter />
      </FavoritesProvider>
    </CartProvider>
  );
}

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

const desktopQuery = '(min-width: 1100px)';
const subscribe = (callback) => {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const isDesktop = () => window.matchMedia(desktopQuery).matches;

const links = [
  ['dashboard', '/admin/dashboard', 'Panel general', 'ri-dashboard-line'],
  ['content', '/admin/contenido', 'Contenido de la tienda', 'ri-store-line'],
  ['categories', '/admin/categorias', 'Categorías', 'ri-price-tag-3-line'],
  ['collections', '/admin/colecciones', 'Colecciones de portada', 'ri-shopping-cart-line'],
  ['orders', '/admin/orders', 'Pedidos', 'ri-shopping-bag-line'],
  ['users', '/admin/users', 'Usuarios', 'ri-user-line'],
  ['reviews', '/admin/reviews', 'Moderar reseñas', 'ri-checkbox-circle-line'],
  ['marketing', '/admin/marketing', 'Marketing y cupones', 'ri-mail-line'],
  ['audit', '/admin/audit', 'Historial administrativo', 'ri-time-line'],
];

export default function AdminLayout({ children, route, user, authReady }) {
  const menuRef = useRef(null);
  const restoreFocus = useRef(false);
  const subscribeToDesktop = useCallback(
    (callback) =>
      subscribe(() => {
        // Capture before React closes the details and the browser moves focus to body.
        restoreFocus.current = !isDesktop() && menuRef.current?.contains(document.activeElement);
        callback();
      }),
    [],
  );
  const desktop = useSyncExternalStore(subscribeToDesktop, isDesktop, () => false);
  const [menuOpen, setMenuOpen] = useState(false);
  useLayoutEffect(() => {
    if (!desktop && !menuOpen && restoreFocus.current)
      menuRef.current?.querySelector('summary')?.focus({ preventScroll: true });
    restoreFocus.current = false;
  }, [desktop, menuOpen]);
  if (!authReady)
    return (
      <p className="products-section" role="status">
        Comprobando acceso…
      </p>
    );
  if (!['owner', 'admin'].includes(user?.role)) {
    // The history page retains its more specific owner-only access message.
    if (route === 'audit') return children;
    return (
      <section className="admin-container container">
        <h1>Acceso administrativo requerido</h1>
        <p>Necesitas una cuenta administrativa con verificación en dos pasos.</p>
        <a
          className="btn btn-outline"
          href={user ? '/' : `/login?next=${encodeURIComponent(location.pathname)}`}
        >
          {user ? 'Volver a la tienda' : 'Iniciar sesión'}
        </a>
      </section>
    );
  }
  const active = route === 'order' ? 'orders' : route;
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Secciones del panel">
        <details
          ref={menuRef}
          className="admin-navigation"
          open={desktop || menuOpen}
          onToggle={(event) => {
            if (!desktop) setMenuOpen(event.currentTarget.open);
          }}
        >
          <summary>
            Secciones del panel <span aria-hidden="true">⌄</span>
          </summary>
          <nav aria-label="Navegación administrativa">
            <p className="admin-navigation-heading">Administración</p>
            <ul>
              {links
                .filter(([name]) => name !== 'audit' || user.role === 'owner')
                .map(([name, href, label, icon]) => (
                  <li key={name}>
                    <a href={href} aria-current={active === name ? 'page' : undefined}>
                      <i className={icon} aria-hidden="true" />
                      <span>{label}</span>
                    </a>
                  </li>
                ))}
            </ul>
          </nav>
        </details>
      </aside>
      <div className="admin-workspace">{children}</div>
    </div>
  );
}

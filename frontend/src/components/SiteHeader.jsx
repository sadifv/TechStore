import { useState } from 'react';
import { requestJson } from '../api.js';
import { useCartActions, useCartState } from './CartContext.js';

export default function SiteHeader({ user }) {
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { count, drawerOpen } = useCartState();
  const { setDrawerOpen } = useCartActions();
  async function logout(event) {
    event.preventDefault();
    setLogoutError('');
    try {
      await requestJson('/api/auth/logout', { method: 'POST' });
      location.assign('/');
    } catch (error) {
      setLogoutError(error.message);
    }
  }
  return (
    <nav className="navbar" aria-label="Navegación principal">
      <a href="/#inicio" className="navbar-logo" aria-label="TechStore - Inicio">
        <i className="ri-store-line" aria-hidden="true" />
        <span>TechStore</span>
      </a>
      <button
        type="button"
        className="navbar-toggle"
        aria-expanded={open}
        aria-controls="navbar-menu"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        onClick={() => setOpen(!open)}
      >
        <i className={open ? 'ri-close-line' : 'ri-menu-line'} aria-hidden="true" />
      </button>
      <ul id="navbar-menu" className={`navbar-menu ${open ? 'active' : ''}`}>
        <li>
          <a href="/#inicio" onClick={() => setOpen(false)}>
            <i className="ri-home-line" aria-hidden="true" /> Inicio
          </a>
        </li>
        <li>
          <a href="/catalogo" onClick={() => setOpen(false)}>
            <i className="ri-shopping-bag-line" aria-hidden="true" /> Catálogo
          </a>
        </li>
        <li>
          <a href="/#contacto" onClick={() => setOpen(false)}>
            <i className="ri-mail-line" aria-hidden="true" /> Contacto
          </a>
        </li>
        <li>
          <a href="/#ai-assistant" onClick={() => setOpen(false)}>
            <i className="ri-robot-line" aria-hidden="true" /> IA Assistant
          </a>
        </li>
        <li>
          <button
            type="button"
            id="cart-btn"
            className="cart-btn-nav"
            aria-label={`Ver carrito, ${count} productos`}
            aria-controls="cart-drawer"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <i className="ri-shopping-cart-2-line" aria-hidden="true" />
            <span id="cart-count" className="cart-badge">
              {count}
            </span>
          </button>
        </li>
        {user ? (
          <>
            <li>
              <a href="/profile" className="user-greeting" title="Ver mi perfil">
                <i className="ri-user-smile-line" aria-hidden="true" /> {user.name}
              </a>
            </li>
            {['admin', 'owner'].includes(user.role) && (
              <li>
                <a href="/admin/dashboard" className="btn btn-primary">
                  <i className="ri-user-settings-line" aria-hidden="true" /> Panel Admin
                </a>
              </li>
            )}
            <li>
              <form onSubmit={logout} className="navbar-logout-form">
                <button type="submit" className="btn btn-secondary">
                  <i className="ri-logout-box-r-line" aria-hidden="true" /> Salir
                </button>
                {logoutError && (
                  <span className="form-status error" role="status">
                    {logoutError}
                  </span>
                )}
              </form>
            </li>
          </>
        ) : (
          <>
            <li>
              <a href="/login" className="btn btn-secondary">
                <i className="ri-user-line" aria-hidden="true" /> Iniciar Sesión
              </a>
            </li>
            <li>
              <a href="/register" className="btn btn-primary">
                <i className="ri-user-add-line" aria-hidden="true" /> Registrarse
              </a>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}

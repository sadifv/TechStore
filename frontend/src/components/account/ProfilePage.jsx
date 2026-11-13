import FavoritesSection from '../favorites/FavoritesSection.jsx';
import AddressBookSection from './AddressBookSection.jsx';
import AccountSecuritySection from './AccountSecuritySection.jsx';
import ProfileOrders from './ProfileOrders.jsx';

export function ProfilePage({ user }) {
  return (
    <section className="container profile-container" aria-labelledby="profile-heading">
      <header className="profile-card">
        <span className="profile-avatar" aria-hidden="true"><i className="ri-user-3-line" /></span>
        <article className="profile-details">
          <h1 id="profile-heading">Mi Cuenta</h1>
          <p><strong>Nombre:</strong> {user?.name || 'Usuario'}</p>
          <p><strong>Correo:</strong> {user?.email || '—'}</p>
        </article>
        <nav className="profile-navigation" aria-label="Secciones de mi cuenta">
          <a href="#profile-orders">Mis pedidos</a>
          <a href="#favorites-heading">Favoritos</a>
          <a href="#address-book-heading">Direcciones</a>
          <a href="#account-security-heading">Datos y seguridad</a>
        </nav>
      </header>
      <ProfileOrders />
      <FavoritesSection />
      <AddressBookSection />
      <AccountSecuritySection user={user} />
    </section>
  );
}

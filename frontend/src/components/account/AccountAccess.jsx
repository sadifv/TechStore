export default function AccountAccess({ user, ready, children }) {
  if (!ready)
    return (
      <section className="products-section">
        <p role="status">Cargando tu cuenta…</p>
      </section>
    );
  if (user) return children;
  return (
    <section className="products-section">
      <h1>Inicia sesión para ver tu cuenta</h1>
      <a className="btn btn-primary" href="/login?next=%2Fprofile">
        Iniciar sesión
      </a>
    </section>
  );
}

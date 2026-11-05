export function AdminNotice({ error }) {
  return error ? (
    <section className="admin-container container">
      <p className="form-status error" role="alert">
        {error}
      </p>
      <a className="btn btn-secondary" href="/login">
        Inicia sesión con una cuenta administradora
      </a>
    </section>
  ) : null;
}

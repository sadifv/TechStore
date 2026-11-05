export default function SessionError({ error }) {
  return (
    <main className="container standalone-page">
      <section className="standalone-card" aria-labelledby="session-check-heading">
        <h1 id="session-check-heading">No pudimos comprobar tu sesión</h1>
        <p role="alert">{error}</p>
        <p>Esto no significa que tu sesión se haya cerrado. Inténtalo de nuevo más tarde.</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          Volver a comprobar
        </button>
      </section>
    </main>
  );
}

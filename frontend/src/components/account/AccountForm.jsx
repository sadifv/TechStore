export default function AccountForm({
  title,
  description,
  children,
  onSubmit,
  status,
  statusType = 'error',
  buttonText,
  busy,
  headingRef,
}) {
  return (
    <section className="login-container container" aria-label={title}>
      <article className="login-card">
        <h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
          {title}
        </h1>
        {description && <p className="auth-description">{description}</p>}
        <form className="auth-form" onSubmit={onSubmit}>
          {children}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Procesando…' : buttonText}
          </button>
          {status && (
            <output className={`form-status ${statusType}`} aria-live="polite">
              {status}
            </output>
          )}
        </form>
      </article>
    </section>
  );
}

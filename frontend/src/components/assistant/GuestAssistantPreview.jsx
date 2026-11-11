export default function GuestAssistantPreview() {
  return (
    <div className="techbot-preview">
      <header className="techbot-preview-copy">
        <p className="editorial-kicker">Asistente TechBot</p>
        <h2 id="ai-title">Encuentra productos según tu uso y presupuesto.</h2>
        <p>Pregunta por el catálogo y explora opciones para trabajar, estudiar o disfrutar.</p>
        <p className="techbot-access-note">
          Crea tu cuenta o inicia sesión para conversar con TechBot.
        </p>
        <nav className="ai-login-actions" aria-label="Acceder a TechBot">
          <a href="/register?next=%2F%23ai-assistant" className="btn btn-primary">
            Crear cuenta
          </a>
          <a href="/login?next=%2F%23ai-assistant" className="btn btn-secondary">
            Iniciar sesión
          </a>
        </nav>
      </header>
      <section className="techbot-example" aria-labelledby="techbot-example-title">
        <h3 id="techbot-example-title">Ejemplo de conversación</h3>
        <p className="techbot-example-question">
          <span>Tú</span>
          Busco una laptop para estudiar.
        </p>
        <section className="techbot-example-answer" aria-label="Respuesta de ejemplo de TechBot">
          <p className="techbot-example-sender">
            <i className="ri-robot-line" aria-hidden="true" /> TechBot
          </p>
          <p>
            ¿Qué programas vas a usar y cuál es tu presupuesto máximo?
          </p>
        </section>
      </section>
    </div>
  );
}

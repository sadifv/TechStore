export default function BuildKitProgress({ steps, busy }) {
  return (
    <nav className="build-kit-progress" data-count={steps.length} aria-label="Progreso de la selección">
      <ol>
        {steps.map((step, index) => (
          <li key={step.target} data-state={step.state}>
            <button
              type="button"
              disabled={busy || step.disabled}
              aria-current={step.state === 'current' ? 'step' : undefined}
              onClick={() => document.getElementById(step.target)?.focus()}
            >
              <span className="build-step-number" aria-hidden="true">
                {step.state === 'selected' ? '✓' : index + 1}
              </span>
              <span>
                <strong>{step.label}</strong>
                <small>
                  {step.state === 'selected'
                    ? 'Seleccionado'
                    : step.state === 'current'
                      ? 'Ahora'
                      : 'Pendiente'}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

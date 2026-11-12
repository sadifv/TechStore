import { useEffect, useRef, useState } from 'react';
import useGuideNarration from './useGuideNarration.js';
import GuideScene from './GuideScene.jsx';
import { purchaseGuideSteps as steps } from './purchaseGuideSteps.js';

function PurchaseGuideDialog({ onClose }) {
  const dialogRef = useRef(null);
  const [step, setStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const narration = useGuideNarration();
  const playing = narration.speaking;
  const stopNarration = narration.stop;
  let playbackLabel = 'Iniciar recorrido';
  if (playing) playbackLabel = 'Pausar narración';
  else if (narration.paused) playbackLabel = 'Reanudar narración';
  else if (step === steps.length - 1) playbackLabel = 'Volver a escuchar';

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      setReducedMotion(media.matches);
    };
    const pauseWhenHidden = () => {
      if (document.hidden) stopNarration();
    };
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => {
      media.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      document.body.style.overflow = previousOverflow;
      dialog.close();
    };
  }, [stopNarration]);

  function selectStep(nextStep) {
    narration.stop();
    setStep(nextStep);
  }

  function togglePlayback() {
    if (playing) {
      narration.pause();
      return;
    }
    if (narration.paused) {
      narration.resume();
      return;
    }
    const startStep = step === steps.length - 1 ? 0 : step;
    narration.listen(startStep, setStep);
  }

  return (
    <dialog
      ref={dialogRef}
      className="purchase-guide"
      aria-labelledby="purchase-guide-title"
      aria-describedby="purchase-guide-disclaimer"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <header className="purchase-guide-header">
        <h2 id="purchase-guide-title">Así compras en TechStore</h2>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          autoFocus
          aria-label="Cerrar guía"
        >
          ✕
        </button>
      </header>
      <p id="purchase-guide-disclaimer" className="purchase-guide-disclaimer">
        Demostración: no crea pedidos ni reserva productos.
      </p>
      <div className="purchase-guide-layout">
        <GuideScene step={step} playing={playing && !reducedMotion} />
        <section className="purchase-guide-explanation" aria-label="Recorrido de TechStore">
          <p className="editorial-kicker">
            {step === 0 ? 'Conoce el proyecto' : `Cómo comprar / 0${step}`}
          </p>
          <header role="status" aria-live="polite" aria-atomic="true">
            <h3>{steps[step].title}</h3>
            <p>{steps[step].description}</p>
          </header>
          {step === 4 && (
            <p className="purchase-guide-warning">
              Abrir WhatsApp no envía el mensaje ni confirma el pago.
            </p>
          )}
        </section>
        <nav className="purchase-guide-steps" aria-label="Elegir paso de la demostración">
          {steps.map((item, index) => (
            <button
              type="button"
              key={item.title}
              aria-label={`${index === 0 ? 'Presentación' : `Paso ${index}`}. ${item.title}`}
              aria-current={step === index ? 'step' : undefined}
              onClick={() => selectStep(index)}
            >
              <span aria-hidden="true">{index === 0 ? '▶' : `0${index}`}</span>
              {item.title}
            </button>
          ))}
        </nav>
      </div>
      <footer className="purchase-guide-controls">
        <div className="purchase-guide-playback">
          {narration.supported ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={togglePlayback}
              aria-pressed={playing || narration.paused}
            >
              {playbackLabel}
            </button>
          ) : (
            <p>Audio no disponible. Puedes recorrer las escenas y leer cada paso.</p>
          )}
        </div>
        <nav aria-label="Controles de la demostración">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={step === 0}
            onClick={() => selectStep(step - 1)}
          >
            Paso anterior
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={step === steps.length - 1}
            onClick={() => selectStep(step + 1)}
          >
            Siguiente paso
          </button>
        </nav>
        <p className="purchase-guide-voice-note">
          Narración continua en español ecuatoriano. {reducedMotion ? 'Animaciones reducidas.' : ''}
        </p>
        <p className="purchase-guide-audio-error" role="status">
          {narration.error}
        </p>
      </footer>
    </dialog>
  );
}

export default function PurchaseGuide() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-secondary"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Cómo comprar
      </button>
      {open && <PurchaseGuideDialog onClose={close} />}
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import useGuideNarration from './useGuideNarration.js';

const steps = [
  {
    title: 'Elige un producto',
    description: 'Explora el catálogo, revisa la ficha y pulsa «Agregar al Carrito».',
  },
  {
    title: 'Revisa tu carrito',
    description: 'Comprueba productos, cantidades y subtotal. Después pulsa «Proceder al Pago».',
  },
  {
    title: 'Completa tus datos',
    description:
      'Como invitado, indica tu nombre y correo de contacto. Revisa la dirección y, si tienes uno, tu cupón. Pulsa «Continuar por WhatsApp» para preparar el pedido y abrir el mensaje.',
  },
  {
    title: 'Coordina por WhatsApp',
    description:
      'En la compra real se prepara un mensaje con tu pedido. Envíalo desde WhatsApp y coordina disponibilidad y pago con la tienda.',
  },
];

function ExampleProduct() {
  return (
    <figure className="purchase-guide-product">
      <img src="/images/products/lg-ultragear-27-ref.jpg" alt="" />
      <figcaption>
        Monitor de ejemplo <strong>$329.00</strong>
      </figcaption>
    </figure>
  );
}

function GuideScene({ step, playing }) {
  return (
    <section
      className="purchase-guide-scene"
      data-step={step}
      data-playing={playing}
      aria-hidden="true"
      key={step}
    >
      <header className="purchase-guide-window">
        <span>
          <b>TechStore</b> / {['Catálogo', 'Tu Carrito', 'Finalizar Compra', 'WhatsApp'][step]}
        </span>
        <span>DEMO</span>
      </header>
      <div className="purchase-guide-stage">
        {step === 0 && (
          <>
            <ExampleProduct />
            <span className="purchase-guide-action">
              Agregar al Carrito <span>+</span>
            </span>
          </>
        )}
        {step === 1 && (
          <>
            <ExampleProduct />
            <p className="purchase-guide-quantity">
              Cantidad <span>− &nbsp; 1 &nbsp; +</span>
            </p>
            <p className="purchase-guide-subtotal">
              Subtotal <strong>$329.00</strong>
            </p>
            <span className="purchase-guide-action">
              Proceder al Pago <span>→</span>
            </span>
          </>
        )}
        {step === 2 && (
          <>
            <dl className="purchase-guide-fields">
              <dt>Nombre Completo</dt>
              <dd>Cliente de ejemplo</dd>
              <dt>Correo electrónico de contacto</dt>
              <dd>cliente@example.invalid</dd>
              <dt>Dirección</dt>
              <dd>Datos de ejemplo, si corresponde</dd>
              <dt>Cupón de descuento</dt>
              <dd>Opcional</dd>
            </dl>
            <p className="purchase-guide-subtotal">
              Subtotal antes del cupón <strong>$329.00</strong>
            </p>
            <span className="purchase-guide-action">
              Continuar por WhatsApp <span>→</span>
            </span>
          </>
        )}
        {step === 3 && (
          <>
            <p className="purchase-guide-message-label">Mensaje preparado · ejemplo</p>
            <blockquote className="purchase-guide-message">
              Hola, quiero coordinar mi pedido de TechStore.
              <span>1 × Monitor de ejemplo</span>
              <strong>Total de ejemplo: $329.00</strong>
            </blockquote>
            <p className="purchase-guide-send">
              Tú envías el mensaje en WhatsApp <span>↗</span>
            </p>
            <p className="purchase-guide-payment">Pago pendiente de coordinar con la tienda</p>
          </>
        )}
        {step < 3 && (
          <svg className="purchase-guide-pointer" width="30" height="36" viewBox="0 0 30 36">
            <path
              d="M3 2v27l7-7 6 12 6-3-6-11 10-1Z"
              fill="var(--color-text)"
              stroke="var(--color-surface)"
              strokeWidth="2"
            />
          </svg>
        )}
      </div>
    </section>
  );
}

function PurchaseGuideDialog({ onClose }) {
  const dialogRef = useRef(null);
  const [step, setStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [playing, setPlaying] = useState(false);
  const narration = useGuideNarration();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      setReducedMotion(media.matches);
      setPlaying(false);
    };
    const pauseWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => {
      media.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      document.body.style.overflow = previousOverflow;
      dialog.close();
    };
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion) return undefined;
    const timer = window.setTimeout(() => {
      if (step === steps.length - 1) setPlaying(false);
      else setStep(step + 1);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [step, playing, reducedMotion]);

  function selectStep(nextStep) {
    narration.stop();
    setPlaying(false);
    setStep(nextStep);
  }

  function togglePlayback() {
    narration.stop();
    if (!playing && step === steps.length - 1) setStep(0);
    setPlaying(!playing);
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
        <section className="purchase-guide-explanation" aria-label="Pasos de compra">
          <p className="editorial-kicker">Cómo comprar / 0{step + 1}</p>
          <div role="status" aria-live="polite" aria-atomic="true">
            <h3>{steps[step].title}</h3>
            <p>{steps[step].description}</p>
          </div>
          {step === 3 && (
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
                aria-label={`${index + 1}. ${item.title}`}
                aria-current={step === index ? 'step' : undefined}
                onClick={() => selectStep(index)}
              >
                <span aria-hidden="true">0{index + 1}</span>
                {item.title}
              </button>
            ))}
          </nav>
      </div>
      <footer className="purchase-guide-controls">
        <div className="purchase-guide-playback">
        <section className="purchase-guide-narration" aria-label="Narración opcional">
          {narration.supported ? (
            <button type="button" className="btn btn-secondary" onClick={() => {
              if (narration.speaking) narration.stop();
              else {
                setPlaying(false);
                narration.listen(`/audio/como-comprar/paso-${step + 1}.mp3`);
              }
            }}>
              {narration.speaking ? 'Detener audio' : 'Escuchar este paso'}
            </button>
          ) : <p>Audio no disponible en este navegador. Puedes leer todos los pasos.</p>}
        </section>
        {reducedMotion ? (
          <p>Pasos estáticos: movimiento reducido activado.</p>
        ) : (
          <button type="button" className="btn btn-primary" onClick={togglePlayback}>
            {playing ? 'Pausar' : step === steps.length - 1 ? 'Volver a reproducir' : 'Reproducir'}
          </button>
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
        <p className="purchase-guide-voice-note">Narración en español.</p>
        <p className="purchase-guide-audio-error" role="status">{narration.error}</p>
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

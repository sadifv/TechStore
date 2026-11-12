import { useEffect, useRef, useState } from 'react';
import useGuideNarration from './useGuideNarration.js';

const steps = [
  {
    title: 'Conoce TechStore',
    description:
      'Explora laptops, audio y periféricos; arma una PC con el configurador o pídele a TechBot orientación según tu uso y presupuesto. Cuando encuentres lo que necesitas, así haces tu pedido.',
  },
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
      'En la compra real se prepara un mensaje con tu pedido. Envíalo desde WhatsApp y coordina disponibilidad y pago con la tienda. Gracias por acompañarme; sigue explorando la tienda y encuentra lo que buscas.',
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
  const views = ['TechStore', 'Catálogo', 'Tu Carrito', 'Finalizar Compra', 'WhatsApp'];
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
          <b>TechStore</b> / {views[step]}
        </span>
        <span>VISTA GUIADA</span>
      </header>
      <div className="purchase-guide-stage">
        {step === 0 && (
          <div className="purchase-guide-overview">
            <div className="purchase-guide-overview-visual">
              <img src="/images/products/lg-ultragear-27-ref.jpg" alt="" />
            </div>
            <header>
              <span className="purchase-guide-overview-kicker">TECNOLOGÍA PARA TU DÍA</span>
              <strong>Encuentra tu próximo equipo</strong>
            </header>
            <div className="purchase-guide-overview-grid">
              <article className="purchase-guide-overview-item">
                <span aria-hidden="true">01</span>
                <strong>Explora el catálogo</strong>
                <p>Laptops, audio y periféricos</p>
              </article>
              <article className="purchase-guide-overview-item">
                <span aria-hidden="true">02</span>
                <strong>Arma tu PC</strong>
                <p>Revisa los componentes</p>
              </article>
              <article className="purchase-guide-overview-item">
                <span aria-hidden="true">03</span>
                <strong>Consulta a TechBot</strong>
                <p>Busca según tu uso y presupuesto</p>
              </article>
            </div>
          </div>
        )}
        {step === 1 && (
          <>
            <ExampleProduct />
            <span className="purchase-guide-action">
              Agregar al Carrito <span>+</span>
            </span>
          </>
        )}
        {step === 2 && (
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
        {step === 3 && (
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
        {step === 4 && (
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
        {step > 0 && step < 4 && (
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
  const narration = useGuideNarration();
  const playing = narration.speaking;
  const stopNarration = narration.stop;

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
          <div role="status" aria-live="polite" aria-atomic="true">
            <h3>{steps[step].title}</h3>
            <p>{steps[step].description}</p>
          </div>
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
              {playing
                ? 'Pausar narración'
                : narration.paused
                  ? 'Reanudar narración'
                  : step === steps.length - 1
                    ? 'Volver a escuchar'
                    : 'Iniciar recorrido'}
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

import { purchaseGuideSteps } from './purchaseGuideSteps.js';

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

export default function GuideScene({ step, playing }) {
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
          <b>TechStore</b> / {purchaseGuideSteps[step].view}
        </span>
        <span>VISTA GUIADA</span>
      </header>
      <div className="purchase-guide-stage">
        {step === 0 && (
          <div className="purchase-guide-overview">
            <figure className="purchase-guide-overview-visual">
              <img src="/images/products/lg-ultragear-27-ref.jpg" alt="" />
            </figure>
            <header>
              <span className="purchase-guide-overview-kicker">TECNOLOGÍA PARA TU DÍA</span>
              <strong>Encuentra tu próximo equipo</strong>
            </header>
            <ol className="purchase-guide-overview-grid">
              <li className="purchase-guide-overview-item">
                <span aria-hidden="true">01</span>
                <strong>Explora el catálogo</strong>
                <p>Laptops, audio y periféricos</p>
              </li>
              <li className="purchase-guide-overview-item">
                <span aria-hidden="true">02</span>
                <strong>Arma tu PC</strong>
                <p>Revisa los componentes</p>
              </li>
              <li className="purchase-guide-overview-item">
                <span aria-hidden="true">03</span>
                <strong>Consulta a TechBot</strong>
                <p>Busca según tu uso y presupuesto</p>
              </li>
            </ol>
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

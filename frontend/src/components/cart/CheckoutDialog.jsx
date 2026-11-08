import CheckoutAddressSelector from '../account/CheckoutAddressSelector.jsx';
import { restoreCartFocus } from '../dialogs/modalFocus.js';

export default function CheckoutDialog({
  checkoutDialog,
  checkoutOpen,
  setCheckoutOpen,
  user,
  busy,
  status,
  subtotal,
  checkout,
}) {
  return (
    <dialog
      id="checkout-modal"
      ref={checkoutDialog}
      className="checkout-modal"
      aria-labelledby="checkout-modal-title"
      onClose={() => {
        setCheckoutOpen(false);
        requestAnimationFrame(() => restoreCartFocus());
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) setCheckoutOpen(false);
      }}
    >
      <form id="checkout-form" className="modal-container" onSubmit={checkout}>
        <header className="modal-header">
          <h2 id="checkout-modal-title">
            <i className="ri-secure-payment-line" aria-hidden="true" />
            Finalizar Compra
          </h2>
          <button
            type="button"
            id="close-checkout-modal"
            className="modal-close-btn"
            aria-label="Cerrar modal"
            onClick={() => setCheckoutOpen(false)}
          >
            <i className="ri-close-line" />
          </button>
        </header>
        {!user && (
          <fieldset className="form-group" id="guest-checkout-fields">
            <legend>Datos del Comprador</legend>
            <p className="form-field">
              <label htmlFor="guest-name">Nombre Completo</label>
              <input
                type="text"
                id="guest-name"
                name="guestName"
                className="form-control"
                placeholder="Ej. Juan Pérez"
                required
              />
            </p>
            <p className="form-field">
              <label htmlFor="guest-email">Correo electrónico de contacto</label>
              <input
                type="email"
                id="guest-email"
                name="guestEmail"
                className="form-control"
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                required
              />
              <small>
                Usaremos este correo como dato de contacto. La confirmación y coordinación son por
                WhatsApp; no enviamos recibos por correo.
              </small>
            </p>
          </fieldset>
        )}
        <fieldset className="form-group">
          <legend>Método de Pago</legend>
          <p>Completarás el pedido por WhatsApp. Te confirmaremos disponibilidad y los detalles.</p>
        </fieldset>
        <CheckoutAddressSelector user={user} open={checkoutOpen} busy={busy} />
        <fieldset className="form-group">
          <legend>Cupón de descuento</legend>
          <label htmlFor="checkout-coupon-code">Código (opcional)</label>
          <input
            type="text"
            id="checkout-coupon-code"
            name="couponCode"
            className="form-control"
            maxLength="32"
            autoComplete="off"
            placeholder="Ingresa tu código"
          />
          <small>El servidor validará el cupón y calculará el descuento antes del pago.</small>
        </fieldset>
        <section className="checkout-summary-box" aria-label="Resumen del pedido">
          <span>Subtotal antes del cupón:</span>
          <strong>${subtotal.toFixed(2)}</strong>
        </section>
        {status && (
          <output id="checkout-status" className="form-status error" role="status">
            {status}
          </output>
        )}
        <footer className="modal-footer">
          <button
            type="submit"
            id="btn-confirm-order"
            className="btn btn-primary btn-block"
            disabled={busy}
          >
            {busy ? 'Preparando WhatsApp…' : 'Continuar por WhatsApp'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

import { money } from '../../utils/formatters.js';
import { productImageSources } from '../../services/productImages.js';

export default function CartDrawer({
  cartDrawer,
  drawerOpen,
  setDrawerOpen,
  items,
  subtotal,
  setQuantity,
  remove,
  onCheckout,
}) {
  return (
    <aside
      ref={cartDrawer}
      id="cart-drawer"
      className={`cart-drawer${drawerOpen ? ' open' : ''}`}
      role="dialog"
      aria-modal={drawerOpen ? 'true' : undefined}
      aria-hidden={!drawerOpen}
      aria-labelledby="cart-drawer-heading"
      inert={!drawerOpen}
      tabIndex={-1}
    >
      <div
        className="cart-drawer-overlay"
        id="cart-overlay"
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
      />
      <section className="cart-drawer-content">
        <header className="cart-drawer-header">
          <h2 id="cart-drawer-heading">
            <i className="ri-shopping-cart-2-line" aria-hidden="true" /> Tu Carrito
          </h2>
          <button
            id="cart-close-btn"
            className="cart-close-btn"
            type="button"
            aria-label="Cerrar carrito"
            onClick={() => setDrawerOpen(false)}
          >
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </header>
        <section
          id="cart-drawer-body"
          className="cart-drawer-body"
          aria-label="Productos en el carrito"
        >
          {items.length === 0 ? (
            <article className="cart-empty-state">
              <i aria-hidden="true" className="ri-shopping-cart-line" />
              <p>Tu carrito está vacío</p>
            </article>
          ) : (
            items.map((item) => (
              <article className="cart-item" data-id={item.id} key={item.cartItemId || item.id}>
                <img {...productImageSources(item.image)} width={64} height={64} sizes="64px" alt={item.name} />
                <section className="cart-item-details">
                  <h4>{item.name}</h4>
                  {item.unavailable ? (
                    <span className="cart-item-price">Ya no está disponible</span>
                  ) : (
                    <span className="cart-item-price">{money(item.price)}</span>
                  )}
                  <fieldset className="cart-item-controls">
                    <legend className="sr-only">{`Cantidad de ${item.name}`}</legend>
                    <button
                      type="button"
                      className="btn-qty-minus"
                      aria-label="Reducir cantidad"
                      disabled={item.unavailable}
                      onClick={() => setQuantity(item, item.quantity - 1)}
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      className="btn-qty-plus"
                      aria-label="Aumentar cantidad"
                      disabled={item.unavailable}
                      onClick={() => setQuantity(item, item.quantity + 1)}
                    >
                      +
                    </button>
                  </fieldset>
                </section>
                <button
                  type="button"
                  className="cart-item-remove"
                  aria-label={`Eliminar ${item.name}`}
                  onClick={() => remove(item.id, item.cartItemId)}
                >
                  <i aria-hidden="true" className="ri-delete-bin-line" />
                </button>
              </article>
            ))
          )}
        </section>
        <footer className="cart-drawer-footer">
          <p className="cart-summary-row">
            <span>Subtotal:</span>
            <strong id="cart-total">{money(subtotal)}</strong>
          </p>
          <button
            id="cart-checkout-btn"
            type="button"
            className="btn btn-primary btn-block"
            disabled={!items.length || items.some((item) => item.unavailable)}
            onClick={() => {
              onCheckout();
            }}
          >
            <i className="ri-secure-payment-line" aria-hidden="true" />
            Continuar con el pedido
          </button>
        </footer>
      </section>
    </aside>
  );
}

import { useEffect, useRef } from 'react';
import { useCart } from '../CartContext.js';
import { money, useAdminData } from './shared.jsx';

export function CheckoutSuccessPage() {
  const orderId = new URLSearchParams(location.search).get('orderId');
  const { data, error } = useAdminData(
    `/api/orders/success?orderId=${encodeURIComponent(orderId || '')}`,
  );
  const { reconcileGuestItems } = useCart();
  const reconciled = useRef(false);
  useEffect(() => {
    if (data?.guestOrder && !reconciled.current) {
      reconciled.current = true;
      reconcileGuestItems(data.items);
    }
  }, [data, reconcileGuestItems]);
  if (!orderId)
    return (
      <section className="products-section">
        <h1>No se encontró el pedido</h1>
        <a className="btn btn-primary" href="/catalogo">
          Volver al catálogo
        </a>
      </section>
    );
  if (error)
    return (
      <section className="products-section">
        <p className="form-status error" role="alert">
          {error}
        </p>
        <a href="/catalogo">Volver al catálogo</a>
      </section>
    );
  if (!data)
    return (
      <section className="products-section">
        <p role="status">Cargando los datos de tu pedido…</p>
      </section>
    );
  return (
    <section className="checkout-success-container" aria-labelledby="checkout-success-heading">
      <article className="success-card">
        <header>
          <i className="ri-whatsapp-line checkout-success-icon" aria-hidden="true" />
          <h1 id="checkout-success-heading">Tu pedido quedó registrado</h1>
        </header>
        <section className="order-details">
          <p>
            Tu pedido <strong>#{data._id}</strong> quedó registrado con estado pendiente.
          </p>
          <p>
            Total del pedido: <strong>{money(data.totalAmount)}</strong>
          </p>
          {Number(data.discountAmount) > 0 && (
            <p>
              Cupón <strong>{data.couponCode}</strong>: descuento de{' '}
              <strong>{money(data.discountAmount)}</strong>
            </p>
          )}
          <p>
            Para completar la compra, envía el mensaje que se abrió en WhatsApp. La orden no se
            marcará como pagada hasta que la tienda lo confirme.
          </p>
        </section>
        <footer>
          <a href="/catalogo" className="btn btn-primary">
            Volver al Catálogo
          </a>
        </footer>
      </article>
    </section>
  );
}

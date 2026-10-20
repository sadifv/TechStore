import { useEffect, useRef } from 'react';
import { useCartActions } from '../CartContext.js';
import { money, useAdminData } from './shared.jsx';
import { finishCheckoutAttempt } from '../../whatsappCheckout.js';

export function CheckoutSuccessPage() {
  const orderId = new URLSearchParams(location.search).get('orderId');
  const { data, error } = useAdminData(
    `/api/orders/success?orderId=${encodeURIComponent(orderId || '')}`,
  );
  const { reconcileGuestItems } = useCartActions();
  const reconciled = useRef(false);
  useEffect(() => {
    if (!data || reconciled.current) return;
    finishCheckoutAttempt(sessionStorage);
    if (data.guestOrder && !sessionStorage.getItem(`techstore.reconciled.${orderId}`)) {
      reconciled.current = true;
      reconcileGuestItems(data.items);
      sessionStorage.setItem(`techstore.reconciled.${orderId}`, 'true');
    }
  }, [data, orderId, reconcileGuestItems]);
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
  const whatsappUrl = sessionStorage.getItem(`techstore.whatsapp.${orderId}`);
  const expired = data.paymentStatus === 'failed' || new Date(data.expiresAt) <= new Date();
  return (
    <section className="checkout-success-container" aria-labelledby="checkout-success-heading">
      <article className="success-card">
        <header>
          <i className="ri-whatsapp-line checkout-success-icon" aria-hidden="true" />
          <h1 id="checkout-success-heading">Tu pedido quedó registrado</h1>
        </header>
        <section className="order-details">
          <p>
            Pedido <strong>#{data._id}</strong>: {data.paymentStatus === 'paid' ? 'pago confirmado' : expired ? 'cancelado o vencido' : data.contactConfirmed ? 'contacto recibido; pendiente de pago' : 'pendiente de contacto por WhatsApp'}.
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
          {data.paymentStatus === 'pending' && !expired && (
            <>
              <p>Envía el mensaje por WhatsApp para completar la compra. El pago se confirmará cuando la tienda lo verifique. La reserva vence a las {new Date(data.expiresAt).toLocaleString()}.</p>
              {/^https:\/\/wa\.me\/\d+\?text=/.test(whatsappUrl || '') && (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="btn btn-primary">Abrir WhatsApp y enviar el pedido</a>
              )}
            </>
          )}
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

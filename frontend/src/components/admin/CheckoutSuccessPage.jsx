import { useEffect, useRef, useState } from 'react';
import { useCartActions } from '../cart/CartContext.js';
import { money } from '../../utils/formatters.js';
import { finishCheckoutAttempt } from '../../features/cart/whatsappCheckout.js';
import { requestJson } from '../../services/api.js';
import OrderTracking from '../account/OrderTracking.jsx';

export function CheckoutSuccessPage() {
  const orderId = new URLSearchParams(location.search).get('orderId');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(orderId));
  const [loadAttempt, setLoadAttempt] = useState(0);
  const checkoutKey = orderId ? sessionStorage.getItem(`techstore.orderAccess.${orderId}`) : null;
  const { reconcileGuestItems } = useCartActions();
  const reconciled = useRef(false);
  useEffect(() => {
    if (!orderId) return undefined;
    let active = true;
    requestJson('/api/orders/track', {
      method: 'POST',
      body: JSON.stringify({ orderId, checkoutKey }),
    })
      .then((result) => {
        if (active) setData(result.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId, checkoutKey, loadAttempt]);
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
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setError('');
            setLoading(true);
            setLoadAttempt((current) => current + 1);
          }}
        >
          Reintentar carga
        </button>
      </section>
    );
  if (loading || (!data && !error))
    return (
      <section className="products-section">
        <p role="status">Cargando los datos de tu pedido…</p>
      </section>
    );
  const whatsappUrl = sessionStorage.getItem(`techstore.whatsapp.${orderId}`);
  const expired = data.paymentStatus === 'failed' || data.expired || data.status === 'cancelled';
  return (
    <section className="checkout-success-container" aria-labelledby="checkout-success-heading">
      <article className="success-card">
        <header>
          <i className="ri-whatsapp-line checkout-success-icon" aria-hidden="true" />
          <h1 id="checkout-success-heading">Tu pedido quedó registrado</h1>
        </header>
        <section className="order-details">
          <p>
            Pedido <strong>#{data._id}</strong>:{' '}
            {data.paymentStatus === 'paid'
              ? 'pago confirmado'
              : data.expired
                ? 'reserva vencida'
                : data.status === 'cancelled'
                  ? 'cancelado'
                  : expired
                    ? 'no disponible'
                    : data.contactConfirmed
                      ? 'contacto recibido; pendiente de pago'
                      : 'pendiente de contacto por WhatsApp'}
            .
          </p>
          <p>
            Total del pedido: <strong>{money(data.totalAmount)}</strong>
          </p>
          <p>Costo de entrega no incluido; se coordina por WhatsApp.</p>
          {Number(data.discountAmount) > 0 && (
            <p>
              Cupón <strong>{data.couponCode}</strong>: descuento de{' '}
              <strong>{money(data.discountAmount)}</strong>
            </p>
          )}
          {data.paymentStatus === 'pending' && !expired && (
            <>
              <p>
                Envía el mensaje por WhatsApp para completar la compra. El pago se confirmará cuando
                la tienda lo verifique. La reserva vence a las{' '}
                {new Date(data.expiresAt).toLocaleString()}.
              </p>
              {/^https:\/\/wa\.me\/\d+\?text=/.test(whatsappUrl || '') && (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
                  Abrir WhatsApp y enviar el pedido
                </a>
              )}
            </>
          )}
        </section>
        <OrderTracking order={data} checkoutKey={checkoutKey} onUpdate={setData} headingLevel={2} />
        <footer>
          <a href="/catalogo" className="btn btn-outline">
            Volver al Catálogo
          </a>
        </footer>
      </article>
    </section>
  );
}

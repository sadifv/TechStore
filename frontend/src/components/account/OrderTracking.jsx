import { useEffect, useId, useRef, useState } from 'react';
import {
  orderEventLabel,
  orderPaymentLabel,
  orderShippingLabel,
  requestOrderUpdate,
} from './orderTracking.js';

function OrderTime({ value }) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : (
    <time dateTime={date.toISOString()}>{date.toLocaleString('es-EC')}</time>
  );
}

export default function OrderTracking({ order, checkoutKey, onUpdate, headingLevel = 4 }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const refreshButton = useRef(null);
  const confirmButton = useRef(null);
  const cancelButton = useRef(null);
  const headingId = useId();
  const confirmationId = useId();
  const Heading = `h${headingLevel}`;
  const ConfirmationHeading = `h${headingLevel + 1}`;
  useEffect(() => {
    if (confirming) confirmButton.current?.focus();
  }, [confirming]);

  async function update(action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await requestOrderUpdate(action, order._id, checkoutKey);
      onUpdate(updated);
      setConfirming(false);
      setMessage(
        action === 'cancel' ? 'Tu pedido se canceló correctamente.' : 'Seguimiento actualizado.',
      );
    } catch (cause) {
      setError(cause.message);
      // A failed/ambiguous cancellation is never reported as successful. Refresh is available to recover.
      setConfirming(false);
    } finally {
      inFlight.current = false;
      setBusy(false);
      requestAnimationFrame(() => refreshButton.current?.focus());
    }
  }

  return (
    <section className="order-tracking" aria-labelledby={headingId} aria-busy={busy}>
      <Heading id={headingId}>Seguimiento del pedido</Heading>
      <dl className="order-tracking-states">
        <dt>Pago</dt>
        <dd>{orderPaymentLabel(order)}</dd>
        <dt>Envío</dt>
        <dd>{orderShippingLabel(order)}</dd>
      </dl>
      <ol className="order-timeline">
        <li>
          Pedido registrado — <OrderTime value={order.createdAt} />
        </li>
        {(order.events || [])
          .filter((event) => orderEventLabel(event.type))
          .map((event, index) => (
            <li key={`${event.type}-${event.at}-${index}`}>
              {orderEventLabel(event.type)} — <OrderTime value={event.at} />
            </li>
          ))}
      </ol>
      {order.canCancel && (
        <p>
          La reserva vence el <OrderTime value={order.expiresAt} />. Puedes cancelar mientras la
          tienda no haya confirmado el pago.
        </p>
      )}
      {order.paymentStatus === 'paid' && (
        <p>
          El pago ya está confirmado. Para solicitar una cancelación,{' '}
          <a href="/#contacto">contacta con la tienda</a>.
        </p>
      )}
      {order.expired && <p>La reserva venció. Contacta con la tienda antes de realizar un pago.</p>}
      <div className="order-tracking-actions">
        <button
          type="button"
          className="btn btn-outline"
          ref={refreshButton}
          disabled={busy}
          onClick={() => update('track')}
        >
          {busy ? 'Procesando…' : 'Actualizar seguimiento'}
        </button>
        {order.canCancel && !confirming && (
          <button
            type="button"
            className="btn btn-outline"
            ref={cancelButton}
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            Cancelar pedido
          </button>
        )}
      </div>
      {confirming && (
        <section className="order-cancel-confirmation" aria-labelledby={confirmationId}>
          <ConfirmationHeading id={confirmationId}>¿Quieres cancelar este pedido?</ConfirmationHeading>
          <p>
            Se liberará la reserva de los productos y del cupón. Esta acción no se puede deshacer.
          </p>
          <div className="order-tracking-actions">
            <button
              type="button"
              className="btn btn-primary"
              ref={confirmButton}
              disabled={busy}
              onClick={() => update('cancel')}
            >
              Sí, cancelar pedido
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                requestAnimationFrame(() => cancelButton.current?.focus());
              }}
            >
              Conservar pedido
            </button>
          </div>
        </section>
      )}
      <p role="status" className="form-status">
        {message}
      </p>
      {error && (
        <p role="alert" className="form-status error">
          {error} Usa «Actualizar seguimiento» para comprobar el estado actual.
        </p>
      )}
    </section>
  );
}

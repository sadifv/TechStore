import { useState } from 'react';
import { requestJson } from '../api.js';
export default function RestockRequest({ productId }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  return (
    <section className="restock-request" aria-label="Aviso de disponibilidad">
      <h2>Avísame cuando esté disponible</h2>
      <p>
        Un único correo si vuelve a haber unidades. No reserva stock. Debes confirmar tu correo.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setError('');
          setMessage('');
          try {
            const r = await requestJson('/api/restock-alerts', {
              method: 'POST',
              body: JSON.stringify({
                productId,
                email: data.get('email'),
                consent: data.get('consent') === 'on',
              }),
            });
            setMessage(r.message);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Correo electrónico
          <input type="email" name="email" autoComplete="email" maxLength={254} required />
        </label>
        <label className="restock-consent">
          <input type="checkbox" name="consent" required />
          Acepto recibir la confirmación y un aviso para este producto. Podré darme de baja desde el
          correo.
        </label>
        <button type="submit" className="btn btn-outline" disabled={busy}>
          {busy ? 'Solicitando…' : 'Solicitar aviso'}
        </button>
      </form>
      <p role="status">{message}</p>
      {error && (
        <p role="alert" className="form-status error">
          {error}
        </p>
      )}
    </section>
  );
}

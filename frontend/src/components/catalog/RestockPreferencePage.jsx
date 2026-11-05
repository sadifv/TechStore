import { useEffect, useState } from 'react';
import { requestJson } from '../../services/api.js';
export default function RestockPreferencePage() {
  const action = location.pathname.endsWith('/confirmar') ? 'confirm' : 'unsubscribe';
  const storageKey = `techstore.restock.${action}`;
  const [token] = useState(
    () => location.hash.slice(1) || sessionStorage.getItem(storageKey) || '',
  );
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (/^[a-f0-9]{64}$/i.test(token)) sessionStorage.setItem(storageKey, token);
    history.replaceState(null, '', location.pathname);
  }, [storageKey, token]);
  const valid = /^[a-f0-9]{64}$/i.test(token);
  return (
    <section className="container login-container">
      <article className="login-card">
        <h1>
          {action === 'confirm'
            ? 'Confirmar aviso de disponibilidad'
            : 'Cancelar aviso de disponibilidad'}
        </h1>
        {!valid ? (
          <p role="alert">El enlace no es válido o está incompleto.</p>
        ) : done ? (
          <p role="status">{message}</p>
        ) : (
          <>
            <p>
              {action === 'confirm'
                ? 'Confirma que quieres recibir un único aviso cuando vuelva a haber disponibilidad. No reserva inventario.'
                : 'Confirma la baja de este aviso. Un envío ya iniciado podría llegar.'}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                setError('');
                try {
                  const r = await requestJson(`/api/restock-alerts/${action}`, {
                    method: 'POST',
                    body: JSON.stringify({ token }),
                  });
                  setMessage(r.message);
                  setDone(true);
                  sessionStorage.removeItem(storageKey);
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Procesando…' : action === 'confirm' ? 'Confirmar aviso' : 'Confirmar baja'}
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="form-status error">
            {error}
          </p>
        )}
        <p>
          <a href="/catalogo">Volver al catálogo</a>
        </p>
      </article>
    </section>
  );
}

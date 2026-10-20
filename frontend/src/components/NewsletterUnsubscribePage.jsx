import { useState } from 'react';
import { requestJson } from '../api.js';

export default function NewsletterUnsubscribePage() {
  const path = location.pathname;
  const query = new URLSearchParams(location.search);
  const newsletterPath =
    path.startsWith('/api/newsletter/unsubscribe/') || path.startsWith('/newsletter/unsubscribe/');
  const newsletterToken = newsletterPath
    ? decodeURIComponent(path.split('/').at(-1) || '')
    : query.get('newsletter') || '';
  const campaign =
    path.startsWith('/api/marketing/unsubscribe') || path.startsWith('/marketing/unsubscribe');
  const validToken = (token) => /^[a-f0-9]{48}$/i.test(token);
  const valid = validToken(newsletterToken);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirmUnsubscribe() {
    setBusy(true);
    setError('');
    try {
      if (campaign)
        await requestJson('/api/marketing/unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ newsletter: newsletterToken }),
        });
      else
        await requestJson(`/api/newsletter/unsubscribe/${encodeURIComponent(newsletterToken)}`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      setDone(true);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="login-container container">
      <article className="login-card" aria-labelledby="unsubscribe-heading">
        <h1 id="unsubscribe-heading">
          {done ? 'Preferencias actualizadas' : 'Preferencias de correo'}
        </h1>
        {done ? (
          <p>Tu solicitud para dejar de recibir estas comunicaciones se completó.</p>
        ) : valid ? (
          <>
            <p>
              Confirma si quieres dejar de recibir{' '}
              {campaign
                ? 'estas comunicaciones de marketing'
                : 'el boletín de TechStore'}
              .
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={confirmUnsubscribe}
            >
              {busy ? 'Actualizando…' : 'Confirmar baja'}
            </button>
          </>
        ) : (
          <p className="form-status error" role="alert">
            El enlace de baja no es válido o está incompleto.
          </p>
        )}
        {error && (
          <output className="form-status error" role="alert">
            {error}
          </output>
        )}
        <p>
          <a href="/">Volver a TechStore</a>
        </p>
      </article>
    </section>
  );
}

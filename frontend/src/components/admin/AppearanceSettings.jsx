import { useEffect, useState } from 'react';
import { requestJson } from '../../services/api.js';
import { applyTheme } from '../../features/appearance/appearance.js';
import { adminMutation } from '../../services/adminMutation.js';

export default function AppearanceSettings() {
  const [theme, setTheme] = useState('normal');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    requestJson('/api/store/appearance')
      .then((result) => {
        if (active) {
          setTheme(result.theme);
          setReady(true);
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <form
      className="moderation-filter"
      aria-labelledby="appearance-heading"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setMessage('');
        try {
          const result = await adminMutation('/api/admin/appearance', {
            method: 'PATCH',
            body: JSON.stringify({ theme }),
          });
          applyTheme(result.theme);
          setMessage('Tema guardado. Los visitantes lo verán al cargar la página.');
        } catch (cause) {
          setError(cause.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 id="appearance-heading">Estilo de la tienda</h2>
      <p>Elige el tema global que verán tus clientes.</p>
      <label htmlFor="store-theme">Tema</label>
      <select
        id="store-theme"
        value={theme}
        disabled={!ready || busy}
        onChange={(event) => {
          setTheme(event.target.value);
          setMessage('');
        }}
      >
        <option value="normal">Normal · Azul TechStore</option>
        <option value="halloween">Halloween · Violeta, crema y lima</option>
        <option value="christmas">Navidad · Verde pino, marfil y azul hielo</option>
      </select>
      <button className="btn btn-primary" disabled={!ready || busy}>
        {busy ? 'Guardando…' : 'Guardar tema global'}
      </button>
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
    </form>
  );
}

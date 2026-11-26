import { useEffect, useState } from 'react';
import useConfirmation from '../../hooks/useConfirmation.js';
import { requestJson } from '../../services/api.js';
import { date, money } from '../../utils/formatters.js';

const kitNames = {
  pc: 'PC', coffee: 'Café', kitchen: 'Cocina', desk: 'Escritorio',
  study: 'Estudio', gaming: 'Gaming', streaming: 'Streaming',
};

export default function SavedBuildSection() {
  const [result, setResult] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const confirm = useConfirmation({
    title: 'Eliminar armado',
    confirmLabel: 'Eliminar',
    danger: true,
  });
  useEffect(() => {
    const controller = new AbortController();
    requestJson('/api/saved-build', { signal: controller.signal })
      .then(({ selection, builds }) => {
        if (!controller.signal.aborted)
          setResult({ builds: builds ?? (selection ? [{ selection, changes: null }] : []) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ error: true });
      });
    return () => controller.abort();
  }, []);

  async function remove(id) {
    if (!(await confirm('¿Eliminar este armado de Mi cuenta?'))) return;
    setRemoving(true);
    setError('');
    try {
      await requestJson(`/api/saved-build/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setResult(({ builds }) => ({ builds: builds.filter((build) => build.id !== id) }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="order-card" aria-labelledby="saved-build-heading">
      <h2 id="saved-build-heading">Mis armados</h2>
      {!result && <p role="status">Cargando armados…</p>}
      {result?.error && <p role="alert">No se pudieron cargar tus armados.</p>}
      {error && <p role="alert">{error}</p>}
      {result?.builds?.length === 0 && <p>Todavía no has guardado ningún armado.</p>}
      {result?.builds?.length > 0 && (
        <ul className="saved-build-list">
          {result.builds.map(({ id, selection, savedAt, changes }) => {
            const params = new URLSearchParams(selection);
            const kit = kitNames[params.get('kit')] || 'Armado';
            const platform = params.get('platform');
            const products = params.getAll('part');
            return (
              <li key={id || selection}>
                <h3>{platform ? `${kit} ${platform}` : kit}</h3>
                {savedAt && <time dateTime={savedAt}>{date(savedAt)}</time>}
                <p>{products.join(', ')}</p>
                {changes === null && <p>Guarda este armado de nuevo para comparar precios y disponibilidad.</p>}
                {changes?.length > 0 && (
                  <ul aria-label="Cambios desde que guardaste este armado">
                    {changes.map((change) => (
                      <li key={change.name}>
                        <strong>{change.name}</strong>
                        {change.unavailable && ' · Ya no está disponible con este nombre'}
                        {change.currentPrice !== undefined &&
                          ` · Precio: ${money(change.previousPrice)} → ${money(change.currentPrice)}`}
                        {change.available !== undefined && (change.available ? ' · Volvió a estar disponible' : ' · Agotado')}
                      </li>
                    ))}
                  </ul>
                )}
                <footer className="saved-build-actions">
                  <a className="btn btn-secondary" href={`/arma-tu-equipo?${selection}`}>
                    Retomar armado
                  </a>
                  {id && (
                    <button className="btn btn-secondary" disabled={removing} onClick={() => remove(id)} type="button">
                      Eliminar
                    </button>
                  )}
                </footer>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

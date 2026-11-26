import { useEffect, useState } from 'react';
import { requestJson } from '../../services/api.js';

export default function SavedBuildSection() {
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    requestJson('/api/saved-build', { signal: controller.signal })
      .then(({ selection }) => {
        if (!controller.signal.aborted) setResult({ selection });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ error: true });
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="order-card" aria-labelledby="saved-build-heading">
      <h2 id="saved-build-heading">Mi selección guardada</h2>
      {!result && <p role="status">Cargando selección…</p>}
      {result?.error && <p role="alert">No se pudo cargar tu selección.</p>}
      {result && !result.error && !result.selection && (
        <p>Todavía no has guardado una selección.</p>
      )}
      {result?.selection && (
        <a className="btn btn-secondary" href={`/arma-tu-equipo?${result.selection}`}>
          Retomar mi selección
        </a>
      )}
    </section>
  );
}

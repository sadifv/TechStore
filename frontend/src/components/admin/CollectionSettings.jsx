import { useEffect, useState } from 'react';
import { requestJson } from '../../services/api.js';
import { storeCollections } from '../../config/storeCollections.js';

export default function CollectionSettings({ products }) {
  const [key, setKey] = useState('setup');
  const [groups, setGroups] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    requestJson('/api/admin/collections', { signal: controller.signal })
      .then((result) => setGroups(result.collections || {}))
      .catch((error) => {
        if (!controller.signal.aborted) setStatus(error.message);
      });
    return () => controller.abort();
  }, []);
  const ids = groups?.[key] || [];
  const names = new Map(products.map((product) => [product._id, product.name]));
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await requestJson('/api/admin/collections', {
        method: 'PATCH',
        body: JSON.stringify({ key, ids }),
      });
      setStatus('Colección guardada.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="product-comparison">
      <summary>Editar colecciones de la portada</summary>
      <form onSubmit={save}>
        <fieldset disabled={busy || !groups}>
          <legend>Selecciona hasta ocho productos</legend>
          <label>
            {' '}
            Colección{' '}
            <select
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
                setStatus('');
              }}
            >
              {storeCollections.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <ul className="collection-picker">
            {[...new Set([...ids, ...names.keys()])].map((id) => (
              <li key={id}>
                <label>
                  <input
                    type="checkbox"
                    checked={ids.includes(id)}
                    disabled={!ids.includes(id) && ids.length >= 8}
                    onChange={() =>
                      setGroups({
                        ...groups,
                        [key]: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
                      })
                    }
                  />{' '}
                  {names.get(id) || 'Producto no disponible en esta lista'}
                </label>
              </li>
            ))}
          </ul>
          <button className="btn btn-primary" type="submit">
            Guardar colección
          </button>
        </fieldset>
        <p role="status">{status}</p>
      </form>
    </details>
  );
}

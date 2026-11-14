import { useEffect, useState } from 'react';
import { backendAssetUrl, requestJson } from '../../services/api.js';
import { adminMutation } from '../../services/adminMutation.js';
import useStoreCategories from '../../hooks/useStoreCategories.js';

export default function CategorySettings() {
  const { refresh } = useStoreCategories();
  const [settings, setSettings] = useState(null);
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loadedRetry, setLoadedRetry] = useState(-1);
  const loading = loadedRetry !== retry;
  useEffect(() => {
    const controller = new AbortController();
    requestJson('/api/admin/categories', { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setSettings(result);
          setSelected(result.categories?.[0]?.id || '');
          setStatus('');
          setLoadedRetry(retry);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setStatus(error.message);
          setLoadedRetry(retry);
        }
      });
    return () => controller.abort();
  }, [retry]);
  const entries = settings?.categories || [];
  const current = entries.find((entry) => entry.id === selected);
  const change = (field, value) =>
    setSettings((previous) => ({
      ...previous,
      categories: previous.categories.map((entry) =>
        entry.id === selected ? { ...entry, [field]: value } : entry,
      ),
    }));
  const orderEntries = (values) => values.map((entry, order) => ({ ...entry, order }));
  const move = (direction) => {
    const values = [...entries];
    const index = values.findIndex((entry) => entry.id === selected);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= values.length) return;
    [values[index], values[target]] = [values[target], values[index]];
    setSettings((previous) => ({ ...previous, categories: orderEntries(values) }));
  };
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      const result = await adminMutation('/api/admin/categories', {
        method: 'PATCH',
        body: JSON.stringify({
          revision: settings.revision,
          categories: entries.map(({ id, name, image, order }) => ({ id, name, image, order })),
        }),
      });
      setSettings(result);
      refresh();
      setStatus(
        'Categorías guardadas. Los productos conservan su clasificación y los enlaces anteriores siguen funcionando.',
      );
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="collection-settings category-settings">
      <summary>Administrar categorías</summary>
      <form onSubmit={save}>
        <p>
          Crea categorías, cambia sus imágenes y ordena su aparición en la tienda. Al renombrar una
          categoría se actualizan sus productos; los pedidos conservan su historial.
        </p>
        {loading && <p role="status">Cargando categorías…</p>}
        <fieldset disabled={!settings || busy || loading}>
          <legend>Categorías del catálogo</legend>
          <label className="collection-select">
            Categoría
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              {entries.map((entry) => (
                <option value={entry.id} key={entry.id}>
                  {entry.order + 1}. {entry.name}
                </option>
              ))}
            </select>
          </label>
          {current && (
            <>
              <p className="form-field">
                <label htmlFor="category-name">Nombre</label>
                <input
                  id="category-name"
                  value={current.name}
                  onChange={(event) => change('name', event.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
              </p>
              <p className="form-field">
                <label htmlFor="category-image">Imagen HTTPS o ruta de la tienda</label>
                <input
                  id="category-image"
                  value={current.image}
                  onChange={(event) => change('image', event.target.value)}
                  maxLength={1000}
                  placeholder="/images/producto.jpg"
                />
              </p>
              {current.image && /^(?:https:\/\/|\/(?:images|uploads)\/)/.test(current.image) && (
                <figure className="image-preview-container">
                  <img
                    src={backendAssetUrl(current.image)}
                    alt={`Vista previa de ${current.name}`}
                    width="240"
                    height="160"
                    loading="lazy"
                  />
                </figure>
              )}
              <nav className="admin-header-actions" aria-label="Orden de categoría">
                <button
                  className="btn btn-outline"
                  type="button"
                  disabled={current.order === 0}
                  onClick={() => move(-1)}
                >
                  Subir categoría
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  disabled={current.order === entries.length - 1}
                  onClick={() => move(1)}
                >
                  Bajar categoría
                </button>
              </nav>
            </>
          )}
          <nav className="admin-header-actions" aria-label="Acciones de categorías">
            <button
              className="btn btn-outline"
              type="button"
              disabled={entries.length >= 40}
              onClick={() => {
                const id = `category-${crypto.randomUUID()}`;
                setSettings((previous) => ({
                  ...previous,
                  categories: [
                    ...previous.categories,
                    { id, name: 'Nueva categoría', image: '', order: previous.categories.length },
                  ],
                }));
                setSelected(id);
              }}
            >
              Añadir categoría
            </button>
            <button
              className="btn btn-outline"
              type="button"
              disabled={entries.length < 2 || !current}
              onClick={() => {
                if (
                  !window.confirm(
                    '¿Eliminar esta categoría al guardar? Solo se permite si no contiene productos.',
                  )
                )
                  return;
                const remaining = orderEntries(entries.filter((entry) => entry.id !== selected));
                setSettings((previous) => ({ ...previous, categories: remaining }));
                setSelected(remaining[0]?.id || '');
              }}
            >
              Eliminar categoría
            </button>
            <button className="btn btn-primary" type="submit">
              {busy ? 'Guardando…' : 'Guardar categorías'}
            </button>
          </nav>
        </fieldset>
        <button
          className="btn btn-outline"
          type="button"
          disabled={busy || loading}
          onClick={() => {
            if (
              settings &&
              !window.confirm('¿Descartar los cambios sin guardar y recargar categorías?')
            )
              return;
            setRetry((value) => value + 1);
          }}
        >
          Recargar categorías
        </button>
        <p role="status">{status}</p>
      </form>
    </details>
  );
}

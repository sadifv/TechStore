import { useEffect, useRef, useState } from 'react';
import { backendAssetUrl, requestJson } from '../../services/api.js';
import { adminMutation } from '../../services/adminMutation.js';
import useStoreCategories from '../../hooks/useStoreCategories.js';

export default function CategorySettings({ standalone = false }) {
  const { refresh } = useStoreCategories();
  const [mode, setMode] = useState('browse');
  const snapshot = useRef(null);
  const editButton = useRef(null);
  const nameInput = useRef(null);
  const [failed, setFailed] = useState(false);
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
          setFailed(false);
          setMode('browse');
          setSelected(result.categories?.[0]?.id || '');
          setStatus('');
          setLoadedRetry(retry);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setStatus(error.message);
          setFailed(true);
          setLoadedRetry(retry);
        }
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (mode !== 'browse') nameInput.current?.focus();
  }, [mode]);
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
  function begin(nextMode) {
    snapshot.current = settings;
    setStatus('');
    setFailed(false);
    setMode(nextMode);
    if (nextMode === 'create') {
      const id = 'category-' + crypto.randomUUID();
      setSettings({
        ...settings,
        categories: [...entries, { id, name: '', image: '', order: entries.length }],
      });
      setSelected(id);
    }
  }
  function finish(result) {
    setSettings(result);
    setSelected(
      result.categories.find((entry) => entry.id === selected)?.id ||
        result.categories[0]?.id ||
        '',
    );
    setMode('browse');
    requestAnimationFrame(() => editButton.current?.focus());
  }
  async function persist(values) {
    if (busy || loading || !settings) return;
    setBusy(true);
    setStatus('');
    try {
      const result = await adminMutation('/api/admin/categories', {
        method: 'PATCH',
        body: JSON.stringify({
          revision: settings.revision,
          categories: values.map(({ id, name, image, order }) => ({ id, name, image, order })),
        }),
      });
      finish(result);
      setFailed(false);
      refresh();
      setStatus(
        'Categorías guardadas. Los productos conservan su clasificación y los enlaces anteriores siguen funcionando.',
      );
    } catch (error) {
      setFailed(true);
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }
  function save(event) {
    event.preventDefault();
    if (mode !== 'browse') persist(entries);
  }
  const Container = standalone ? 'section' : 'details';
  return (
    <Container
      className="collection-settings category-settings"
      aria-label={standalone ? 'Editor de categorías' : undefined}
    >
      {!standalone && <summary>Administrar categorías</summary>}
      <form onSubmit={save}>
        <p>
          Crea categorías, cambia sus imágenes y ordena su aparición en la tienda. Al renombrar una
          categoría se actualizan sus productos; los pedidos conservan su historial.
        </p>
        {loading && <p role="status">Cargando categorías…</p>}
        <fieldset disabled={!settings || busy || loading}>
          <legend>
            {mode === 'browse'
              ? 'Categorías del catálogo'
              : mode === 'create'
                ? 'Nueva categoría'
                : 'Editar categoría'}
          </legend>
          {mode === 'browse' && (
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
          )}
          {mode === 'browse' && (
            <div className="category-actions">
              <button
                ref={editButton}
                className="btn btn-primary"
                type="button"
                disabled={!current}
                onClick={() => begin('edit')}
              >
                Editar categoría
              </button>
              <button
                className="btn btn-outline"
                type="button"
                disabled={entries.length >= 40}
                onClick={() => begin('create')}
              >
                Añadir categoría
              </button>
            </div>
          )}
          {mode !== 'browse' && current && (
            <>
              <p className="form-field">
                <label htmlFor="category-name">Nombre</label>
                <input
                  ref={nameInput}
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
              {mode === 'edit' && (
                <div className="category-actions" role="group" aria-label="Orden de categoría">
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
                </div>
              )}
            </>
          )}
          {mode !== 'browse' && (
            <div className="category-actions">
              <button className="btn btn-primary" type="submit">
                {busy ? 'Guardando…' : mode === 'create' ? 'Crear categoría' : 'Guardar cambios'}
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => {
                  finish(snapshot.current);
                  setStatus('');
                  setFailed(false);
                }}
              >
                Cancelar
              </button>
            </div>
          )}
          {mode === 'edit' && (
            <aside className="category-danger" aria-label="Eliminar categoría">
              <p>
                Solo puedes eliminar una categoría que no tenga productos. Se pedirá confirmación.
              </p>
              <button
                className="btn btn-outline"
                type="button"
                disabled={entries.length < 2}
                onClick={() => {
                  if (
                    window.confirm(
                      '¿Eliminar esta categoría? Esta acción se guardará inmediatamente.',
                    )
                  )
                    persist(
                      orderEntries(
                        snapshot.current.categories.filter((entry) => entry.id !== selected),
                      ),
                    );
                }}
              >
                Eliminar categoría
              </button>
            </aside>
          )}
        </fieldset>
        {failed && (
          <button
            className="btn btn-outline"
            type="button"
            disabled={busy || loading}
            onClick={() => {
              if (
                mode !== 'browse' &&
                !window.confirm('¿Descartar los cambios sin guardar y recargar categorías?')
              )
                return;
              setRetry((value) => value + 1);
            }}
          >
            {settings ? 'Recargar categorías' : 'Reintentar carga'}
          </button>
        )}
        <p role={failed ? 'alert' : 'status'}>{status}</p>
      </form>
    </Container>
  );
}

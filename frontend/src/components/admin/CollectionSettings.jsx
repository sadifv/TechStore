import { useEffect, useState } from 'react';
import { requestJson } from '../../services/api.js';
import { storeCollections } from '../../config/storeCollections.js';
import { AdminPagination } from './AdminPagination.jsx';

const defaultDefinitions = storeCollections.map(([key, title], order) => ({
  key,
  title,
  order,
  theme: ['halloween', 'christmas'].includes(key) ? key : 'all',
  enabled: true,
}));

function DefinitionEditor({ definition, busy, onSave, onRemove }) {
  return (
    <form onSubmit={onSave} className="collection-definition-form">
      <fieldset disabled={busy}>
        <legend>{definition ? 'Datos de la colección' : 'Crear una colección'}</legend>
        {!definition && (
          <p className="form-field">
            <label htmlFor="collection-key">Identificador</label>
            <input
              id="collection-key"
              name="key"
              required
              minLength="2"
              maxLength="40"
              pattern="[a-z][a-z0-9-]{1,39}"
              placeholder="mi-coleccion"
            />
            <small>Minúsculas, números y guiones. No cambia al renombrar la colección.</small>
          </p>
        )}
        <p className="form-field">
          <label htmlFor="collection-title">Nombre de la colección</label>
          <input
            id="collection-title"
            name="title"
            required
            maxLength="80"
            defaultValue={definition?.title || ''}
          />
        </p>
        <p className="form-field">
          <label htmlFor="collection-theme">Mostrar en</label>
          <select id="collection-theme" name="theme" defaultValue={definition?.theme || 'all'}>
            <option value="all">Todos los temas</option>
            <option value="normal">Normal</option>
            <option value="halloween">Halloween</option>
            <option value="christmas">Navidad</option>
          </select>
        </p>
        <p className="form-field">
          <label htmlFor="collection-order">Orden</label>
          <input
            id="collection-order"
            type="number"
            name="order"
            min="0"
            max="100"
            step="1"
            required
            defaultValue={definition?.order ?? 0}
          />
        </p>
        <label className="collection-option">
          <input type="checkbox" name="enabled" defaultChecked={definition?.enabled ?? true} />
          Visible en la portada
        </label>
        <p className="admin-header-actions">
          <button className="btn btn-primary" type="submit">
            {definition ? 'Guardar datos' : 'Crear colección'}
          </button>
          {definition && (
            <button className="btn btn-outline" type="button" onClick={onRemove}>
              Eliminar colección
            </button>
          )}
        </p>
      </fieldset>
    </form>
  );
}

export default function CollectionSettings() {
  const [key, setKey] = useState('setup');
  const [groups, setGroups] = useState(null);
  const [definitions, setDefinitions] = useState(defaultDefinitions);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [reload, setReload] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [catalog, setCatalog] = useState({ key: '', products: [], pagination: null, error: '' });
  const catalogKey = `${query}:${page}:${reload}:${catalogRetry}`;
  const catalogStatus = catalog.key === catalogKey ? catalog.error : 'Cargando productos…';
  const visibleProducts = catalog.key === catalogKey ? catalog.products : [];
  const [names, setNames] = useState({});
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    requestJson('/api/admin/collections', { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        // Metadata saves refresh names/definitions, never discard unsaved membership edits.
        setGroups((previous) =>
          previous === null ? result.collections || {} : { ...result.collections, ...previous },
        );
        setDefinitions(result.definitions || defaultDefinitions);
        setNames((previous) => ({
          ...previous,
          ...Object.fromEntries(
            (result.selectedProducts || []).map((product) => [product._id, product.name]),
          ),
        }));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setStatus(error.message);
      });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    if (!expanded) return undefined;
    const controller = new AbortController();
    requestJson(`/api/admin/products?status=active&page=${page}&q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setCatalog({ ...result.data, key: catalogKey, error: '' });
        setNames((previous) => ({
          ...previous,
          ...Object.fromEntries(result.data.products.map((product) => [product._id, product.name])),
        }));
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setCatalog({ key: catalogKey, products: [], pagination: null, error: error.message });
        }
      });
    return () => controller.abort();
  }, [expanded, query, page, reload, catalogKey]);
  const ids = groups?.[key] || [];
  const definition = definitions.find((entry) => entry.key === key);
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
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
  async function saveDefinition(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextKey = definition?.key || form.get('key');
    setBusy(true);
    setStatus('');
    try {
      await requestJson('/api/admin/collections/definition', {
        method: 'PATCH',
        body: JSON.stringify({
          key: nextKey,
          title: form.get('title'),
          theme: form.get('theme'),
          order: Number(form.get('order')),
          enabled: form.has('enabled'),
        }),
      });
      setKey(nextKey);
      setReload((value) => value + 1);
      setStatus('Datos de la colección guardados.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function removeDefinition() {
    setBusy(true);
    setStatus('');
    try {
      await requestJson('/api/admin/collections/definition', {
        method: 'PATCH',
        body: JSON.stringify({ key, remove: true }),
      });
      setKey('');
      setGroups((previous) =>
        Object.fromEntries(Object.entries(previous || {}).filter(([id]) => id !== key)),
      );
      setRemoving(false);
      setReload((value) => value + 1);
      setStatus('Colección eliminada. Los productos se conservan.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }
  function toggle(id) {
    setGroups((previous) => ({
      ...previous,
      [key]: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    }));
  }
  return (
    <details
      className="collection-settings collections-editor"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>Editar colecciones de la portada</summary>
      <div className="collection-settings-content">
        <label className="collection-select">
          Colección
          <select
            value={key}
            disabled={busy || !groups}
            onChange={(event) => {
              setKey(event.target.value);
              setRemoving(false);
              setStatus('');
            }}
          >
            <option value="">Nueva colección</option>
            {definitions.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>
        {groups ? (
          <DefinitionEditor
            key={key}
            definition={definition}
            busy={busy}
            onSave={saveDefinition}
            onRemove={() => setRemoving(true)}
          />
        ) : (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setReload((value) => value + 1)}
          >
            Reintentar carga
          </button>
        )}
        {removing && (
          <section aria-label="Confirmar eliminación" className="empty-state">
            <p>¿Eliminar «{definition?.title}» de la portada? No elimina productos del catálogo.</p>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={removeDefinition}
            >
              Confirmar eliminación
            </button>{' '}
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setRemoving(false)}
            >
              Conservar colección
            </button>
          </section>
        )}
        {definition && (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setQuery(new FormData(event.currentTarget).get('query').trim());
                setPage(1);
              }}
            >
              <p className="form-field">
                <label htmlFor="collection-product-search">
                  Buscar productos para la colección
                </label>
                <input id="collection-product-search" name="query" type="search" maxLength="100" />
              </p>
              <button type="submit" className="btn btn-outline">
                Buscar productos
              </button>
            </form>
            <form onSubmit={save}>
              <fieldset disabled={busy || !groups}>
                <legend>Selecciona hasta ocho productos para mostrar en la portada.</legend>
                <p className="collection-count" role="status">
                  {ids.length} / 8 productos seleccionados
                </p>
                {ids.length > 0 && (
                  <section aria-label="Productos seleccionados">
                    <h3>Selección actual</h3>
                    <ul className="collection-picker">
                      {ids.map((id) => (
                        <li key={id}>
                          <label className="collection-option">
                            <input type="checkbox" checked onChange={() => toggle(id)} />
                            <span>{names[id] || `Producto ${id}`}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <p role="status">{catalogStatus}</p>
                {catalog.key === catalogKey && catalog.error && (
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => setCatalogRetry((value) => value + 1)}
                  >
                    Reintentar productos
                  </button>
                )}
                <ul className="collection-picker">
                  {visibleProducts
                    .filter((product) => !ids.includes(product._id))
                    .map((product) => (
                      <li key={product._id}>
                        <label className="collection-option">
                          <input
                            type="checkbox"
                            checked={false}
                            disabled={ids.length >= 8}
                            onChange={() => toggle(product._id)}
                          />
                          <span>{product.name}</span>
                        </label>
                      </li>
                    ))}
                </ul>
                {!catalogStatus && visibleProducts.length === 0 && (
                  <p>No hay productos que coincidan.</p>
                )}
                <AdminPagination
                  pagination={catalog.key === catalogKey ? catalog.pagination : null}
                  onPage={setPage}
                />
                <button className="btn btn-primary" type="submit">
                  {busy ? 'Guardando…' : 'Guardar colección'}
                </button>
              </fieldset>
            </form>
          </>
        )}
        <p role="status">{status}</p>
      </div>
    </details>
  );
}

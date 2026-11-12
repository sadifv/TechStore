import { useEffect, useRef, useState } from 'react';
import { requestJson } from '../../services/api.js';
import AddressFields from './AddressFields.jsx';
const empty = { label: '', recipient: '', street: '', city: '', country: 'Ecuador', reference: '' };
export default function AddressBookSection() {
  const [data, setData] = useState(null),
    [reload, setReload] = useState(0),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(null),
    [form, setForm] = useState(empty),
    [deleting, setDeleting] = useState(null);
  const title = useRef(null);
  useEffect(() => {
    let active = true;
    requestJson('/api/addresses')
      .then((r) => {
        if (active) {
          setData(r.data);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  async function mutate(url, method, body) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await requestJson(url, { method, body: JSON.stringify(body) });
      setData(r.data);
      setEditing(null);
      setDeleting(null);
      setMessage('Libreta actualizada.');
      requestAnimationFrame(() => title.current?.focus());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="address-book" aria-labelledby="address-book-heading">
      <h2 id="address-book-heading" tabIndex={-1} ref={title}>
        Mis direcciones
      </h2>
      <p>
        Hasta cinco direcciones privadas. Solo se copiarán al pedido si las eliges en el checkout.
      </p>
      {!data && !error ? (
        <p role="status">Cargando direcciones…</p>
      ) : (
        data && (
          <>
            {!data.addresses.length && <p>Aún no has guardado direcciones.</p>}
            <ul className="address-list">
              {data.addresses.map((a) => (
                <li key={a._id}>
                  <article className="order-card">
                    <header className="address-card-heading">
                      <h3>{a.label || 'Dirección'}</h3>
                      {data.defaultAddressId === a._id && (
                        <span className="customer-badge">Predeterminada</span>
                      )}
                    </header>
                    <p>{a.recipient}</p>
                    <p>
                      {a.street}, {a.city}, {a.country}
                    </p>
                    {a.reference && <p>{a.reference}</p>}
                    <div className="customer-actions">
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={busy}
                        onClick={() => {
                          setEditing(a._id);
                          setForm(a);
                          setDeleting(null);
                        }}
                      >
                        Editar dirección
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={busy}
                        onClick={() => {
                          setDeleting(a._id);
                          setEditing(null);
                        }}
                      >
                        Eliminar dirección
                      </button>
                      {data.defaultAddressId !== a._id && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={busy}
                          onClick={() =>
                            mutate(`/api/addresses/${a._id}/default`, 'PUT', {
                              version: data.version,
                            })
                          }
                        >
                          Usar como predeterminada
                        </button>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
            {data.addresses.length < 5 && !editing && (
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() => {
                  setEditing('new');
                  setForm(empty);
                  setDeleting(null);
                }}
              >
                Añadir dirección
              </button>
            )}
            {editing && (
              <form
                className="customer-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  mutate(
                    editing === 'new' ? '/api/addresses' : `/api/addresses/${editing}`,
                    editing === 'new' ? 'POST' : 'PATCH',
                    { ...form, ...(editing === 'new' ? {} : { version: data.version }) },
                  );
                }}
              >
                <h3>{editing === 'new' ? 'Nueva dirección' : 'Editar dirección'}</h3>
                <AddressFields value={form} onChange={setForm} />
                <div className="customer-actions">
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    Guardar dirección
                  </button>
                  <button
                    className="btn btn-outline"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(null);
                      title.current?.focus();
                    }}
                  >
                    Volver sin guardar
                  </button>
                </div>
              </form>
            )}
            {deleting && (
              <section className="order-cancel-confirmation" aria-label="Confirmar eliminación">
                <p>¿Eliminar esta dirección? Los pedidos anteriores conservarán su copia.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    mutate(`/api/addresses/${deleting}`, 'DELETE', { version: data.version })
                  }
                >
                  Confirmar eliminación
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => {
                    setDeleting(null);
                    title.current?.focus();
                  }}
                >
                  Conservar dirección
                </button>
              </section>
            )}
          </>
        )
      )}
      {error && (
        <p role="alert" className="form-status error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn-outline"
        disabled={busy}
        onClick={() => {
          setEditing(null);
          setDeleting(null);
          setReload((n) => n + 1);
        }}
      >
        Recargar direcciones
      </button>
      <p role="status">{message}</p>
    </section>
  );
}

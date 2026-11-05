import { useState, useEffect, useRef } from 'react';
import { useAdminData } from '../../hooks/useAdminData.js';
import { adminMutation } from '../../services/adminMutation.js';
import { AdminNotice } from './AdminNotice.jsx';
const labels = {
  pending: 'Pendientes',
  approved: 'Publicadas',
  rejected: 'Rechazadas',
  hidden: 'Ocultas',
};
export default function ReviewModerationPage() {
  const [status, setStatus] = useState('pending'),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const {
    data,
    error: loadError,
    refresh,
  } = useAdminData(`/api/admin/reviews?status=${status}&page=${page}`);
  const title = useRef(null),
    confirmButton = useRef(null);
  useEffect(() => {
    if (selected) confirmButton.current?.focus();
  }, [selected]);
  return (
    <section className="container admin-container moderation-page">
      <header className="admin-header">
        <h1 ref={title} tabIndex={-1}>
          Moderación de reseñas
        </h1>
        <a href="/admin" className="btn btn-outline">
          ← Volver al dashboard
        </a>
      </header>
      <p className="moderation-guidance">
        Las reseñas requieren una compra verificada. Revisa el texto antes de publicarlo. No puedes
        aprobar tu propia reseña.
      </p>
      <fieldset className="moderation-filter">
        <legend>Filtrar reseñas</legend>
        <label htmlFor="moderation-status">Estado de reseñas</label>
        <select
          id="moderation-status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
            setSelected(null);
          }}
        >
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </fieldset>
      {loadError ? (
        <>
          <AdminNotice error={loadError} />
          <button type="button" className="btn btn-outline" onClick={refresh}>
            Reintentar carga
          </button>
        </>
      ) : !data ? (
        <p role="status">Cargando reseñas…</p>
      ) : (
        <>
          {!data.reviews.length && (
            <section className="moderation-empty" aria-label="Sin reseñas">
              <span aria-hidden="true">☆</span>
              <h2>No hay reseñas en este estado</h2>
              <p>
                Selecciona otro estado o actualiza la lista para consultar las reseñas disponibles.
              </p>
            </section>
          )}
          <ul className="review-list">
            {data.reviews.map((r) => (
              <li key={r._id}>
                <article className="order-card">
                  <h2>
                    {r.productName} · {r.rating}/5
                  </h2>
                  <p>{r.authorLabel} · compra verificada</p>
                  <p className="review-text">{r.text}</p>
                  <div className="customer-actions">
                    {[
                      ['approved', 'Aprobar'],
                      ['rejected', 'Rechazar'],
                      ['hidden', 'Ocultar'],
                    ].map(([value, label]) => (
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={busy}
                        key={value}
                        onClick={() => {
                          setSelected({ review: r, status: value });
                          setError('');
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </article>
              </li>
            ))}
          </ul>
          {(data.totalPages > 1 || page > 1) && (
            <nav aria-label="Páginas de moderación">
              <button
                type="button"
                className="btn btn-outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
              <span>
                {' '}
                {page} de {data.totalPages}{' '}
              </span>
              <button
                type="button"
                className="btn btn-outline"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}
      {selected && (
        <section className="order-cancel-confirmation" aria-label="Confirmar moderación">
          <h2>Confirmar decisión: {labels[selected.status]}</h2>
          <p className="review-text">{selected.review.text}</p>
          <div className="customer-actions">
            <button
              type="button"
              className="btn btn-primary"
              ref={confirmButton}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await adminMutation(
                    `/api/admin/reviews/${encodeURIComponent(selected.review._id)}`,
                    {
                      method: 'PATCH',
                      body: JSON.stringify({
                        status: selected.status,
                        version: selected.review.version,
                      }),
                    },
                  );
                  setMessage('Decisión registrada.');
                  setSelected(null);
                  refresh();
                  requestAnimationFrame(() => title.current?.focus());
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                  requestAnimationFrame(() => (confirmButton.current || title.current)?.focus());
                }
              }}
            >
              Confirmar decisión
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Volver sin cambios
            </button>
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className="form-status error">
          {error} Actualiza la lista antes de decidir de nuevo.
        </p>
      )}
      <button
        type="button"
        className="btn btn-outline"
        disabled={busy}
        onClick={() => {
          setSelected(null);
          refresh();
        }}
      >
        Actualizar lista
      </button>
      <p role="status">{message}</p>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { requestJson } from '../../services/api.js';
const labels = {
  pending: 'Pendiente de moderación',
  approved: 'Publicada',
  rejected: 'Rechazada',
  hidden: 'Oculta',
};
export default function ProductReviews({ productId, user }) {
  const [data, setData] = useState(null),
    [mine, setMine] = useState(null),
    [page, setPage] = useState(1),
    [reload, setReload] = useState(0),
    [error, setError] = useState(''),
    [mineError, setMineError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [rating, setRating] = useState(5),
    [text, setText] = useState(''),
    [mineLoading, setMineLoading] = useState(true);
  const sending = useRef(false);
  useEffect(() => {
    let active = true;
    requestJson(`/api/products/${encodeURIComponent(productId)}/reviews?page=${page}`)
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
  }, [productId, page, reload]);
  useEffect(() => {
    let active = true;
    if (user)
      requestJson(`/api/reviews/mine?productId=${encodeURIComponent(productId)}`)
        .then((r) => {
          if (active) {
            setMine(r.data);
            setRating(r.data.review?.rating || 5);
            setText(r.data.review?.text || '');
            setMineError('');
          }
        })
        .catch((e) => {
          if (active) setMineError(e.message);
        })
        .finally(() => {
          if (active) setMineLoading(false);
        });
    return () => {
      active = false;
    };
  }, [productId, user, reload]);
  async function submit(withdraw = false) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMineError('');
    setMessage('');
    try {
      const result = await requestJson(`/api/reviews/${encodeURIComponent(productId)}`, {
        method: withdraw ? 'DELETE' : 'PUT',
        body: JSON.stringify(
          withdraw
            ? { version: mine.review.version }
            : { rating, text, ...(mine?.review ? { version: mine.review.version } : {}) },
        ),
      });
      setMine(result.data);
      setMessage(
        withdraw
          ? 'Tu reseña se retiró.'
          : 'Reseña guardada. Se publicará cuando la tienda la apruebe.',
      );
      setMineLoading(true);
      setReload((n) => n + 1);
    } catch (e) {
      setMineError(e.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="product-reviews" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading">Reseñas de compradores</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Cargando reseñas…</p>
      ) : (
        <>
          <p>
            {data.count
              ? `${Number(data.average).toFixed(1)}/5 · ${data.count} reseñas publicadas`
              : 'Este producto todavía no tiene reseñas publicadas.'}
          </p>
          <ul className="review-list">
            {data.reviews.map((r, index) => (
              <li key={`${r.createdAt}-${index}`}>
                <article className="order-card">
                  <h3>
                    {r.author} · {r.rating}/5
                  </h3>
                  <p>Compra verificada</p>
                  <p className="review-text">{r.text}</p>
                  <time dateTime={r.createdAt}>
                    {new Date(r.createdAt).toLocaleDateString('es-EC')}
                  </time>
                </article>
              </li>
            ))}
          </ul>
          {(data.totalPages > 1 || page > 1) && (
            <nav aria-label="Páginas de reseñas">
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
      {(error || mineError) && (
        <button
          type="button"
          className="btn btn-outline"
          disabled={busy || (Boolean(user) && mineLoading)}
          onClick={() => {
            setMineLoading(true);
            setReload((n) => n + 1);
          }}
        >
          Actualizar reseñas
        </button>
      )}
      {!user ? (
        <p>
          <a href={`/login?next=${encodeURIComponent(`/producto/${productId}`)}`}>
            Inicia sesión para escribir una reseña
          </a>
        </p>
      ) : mine?.eligible ? (
        <form
          className="customer-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h3>Tu reseña</h3>
          {mine.review && (
            <p>Estado: {mine.review.withdrawn ? 'Retirada' : labels[mine.review.status]}</p>
          )}
          <label htmlFor="review-rating">Puntuación</label>
          <select
            disabled={busy || mineLoading}
            id="review-rating"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            required
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} de 5
              </option>
            ))}
          </select>
          <label>
            Tu experiencia
            <textarea
              disabled={busy || mineLoading}
              value={text}
              onChange={(e) => setText(e.target.value)}
              minLength={10}
              maxLength={2000}
              required
              rows={4}
            />
          </label>
          <p>
            Texto plano, de 10 a 2000 caracteres. No incluyas datos personales. Las ediciones
            vuelven a moderación.
          </p>
          <button type="submit" className="btn btn-primary" disabled={busy || mineLoading}>
            {busy ? 'Guardando…' : 'Enviar para revisión'}
          </button>
          {mine.review && !mine.review.withdrawn && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy || mineLoading}
              onClick={() => submit(true)}
            >
              Retirar mi reseña
            </button>
          )}
        </form>
      ) : !mine && !mineError ? (
        <p role="status">Comprobando tu compra…</p>
      ) : (
        <p>Podrás reseñar este producto cuando tengas un pedido pagado y entregado o completado.</p>
      )}
      {user && !mine?.eligible && mine?.review && !mine.review.withdrawn && (
        <button
          type="button"
          className="btn btn-outline"
          disabled={busy || mineLoading}
          onClick={() => submit(true)}
        >
          Retirar mi reseña
        </button>
      )}
      {mineError && (
        <p role="alert" className="form-status error">
          {mineError}
        </p>
      )}
      <p role="status">{message}</p>
    </section>
  );
}

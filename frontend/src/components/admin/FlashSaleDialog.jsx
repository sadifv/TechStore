import { useEffect, useRef, useState } from 'react';
import { adminMutation } from '../../services/adminMutation.js';
import { money } from '../../utils/formatters.js';

export default function FlashSaleDialog({
  flashProduct,
  setFlashProduct,
  flashDiscount,
  setFlashDiscount,
  flashDuration,
  setFlashDuration,
  busy,
  setBusy,
  refresh,
}) {
  const [error, setError] = useState('');
  const flashDialog = useRef(null);
  useEffect(() => {
    if (flashDialog.current)
      flashProduct ? flashDialog.current.showModal() : flashDialog.current.close();
  }, [flashProduct]);
  async function submitFlash(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminMutation(`/api/admin/products/${flashProduct._id}/flash-sale`, {
        method: 'POST',
        body: JSON.stringify({
          discount: Number(flashDiscount),
          durationHours: Number(flashDuration),
        }),
      });
      flashDialog.current?.close();
      setFlashProduct(null);
      refresh();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={flashDialog}
      className="modal-dialog"
      onClose={() => {
        setFlashProduct(null);
        setError('');
      }}
    >
      <article className="modal-card">
        <header className="modal-header">
          <h2>Configurar oferta relámpago</h2>
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar"
            onClick={() => flashDialog.current?.close()}
          >
            ×
          </button>
        </header>
        <form onSubmit={submitFlash}>
          {error && (
            <p role="alert" className="form-status error">
              {error}
            </p>
          )}
          <p className="form-field">
            <span>Producto</span>
            <output>{flashProduct?.name}</output>
          </p>
          <p className="form-field">
            <span>Precio actual</span>
            <output>{money(flashProduct?.price)}</output>
          </p>
          <fieldset className="form-group-inline">
            <p className="form-field">
              <label htmlFor="flash-discount">Descuento (%)</label>
              <input
                id="flash-discount"
                type="number"
                min="1"
                max="90"
                value={flashDiscount}
                onChange={(event) => setFlashDiscount(Number(event.target.value))}
              />
            </p>
            <p className="form-field">
              <label htmlFor="flash-duration">Duración (horas)</label>
              <input
                id="flash-duration"
                type="number"
                min="1"
                max="168"
                value={flashDuration}
                onChange={(event) => setFlashDuration(Number(event.target.value))}
              />
            </p>
          </fieldset>
          <p>Precio final: {money(Number(flashProduct?.price || 0) * (1 - flashDiscount / 100))}</p>
          <footer className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => flashDialog.current?.close()}
            >
              Cancelar
            </button>
            <button className="btn btn-primary" disabled={busy}>
              Activar oferta
            </button>
          </footer>
        </form>
      </article>
    </dialog>
  );
}

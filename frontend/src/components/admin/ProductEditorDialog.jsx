import { useEffect, useRef, useState } from 'react';
import { backendAssetUrl } from '../../services/api.js';
import { adminMutation } from '../../services/adminMutation.js';
import { categories, placeholder } from '../../config/storeCatalog.js';

export default function ProductEditorDialog({ product, setProduct, refresh, busy, setBusy }) {
  const productDialog = useRef(null);
  const imageFile = useRef(null);
  const [imagePreview, setImagePreview] = useState(placeholder);
  const [formError, setFormError] = useState('');
  useEffect(() => {
    if (productDialog.current)
      product ? productDialog.current.showModal() : productDialog.current.close();
  }, [product]);
  useEffect(() => {
    const file = imageFile.current?.files?.[0];
    if (!file) {
      setImagePreview(backendAssetUrl(product?.image || placeholder));
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [product]);

  async function submitProduct(event) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    const form = new FormData(event.currentTarget);
    const id = form.get('id');
    try {
      await adminMutation(id ? `/api/admin/products/${id}` : '/api/admin/products', {
        method: id ? 'PUT' : 'POST',
        body: form,
      });
      productDialog.current?.close();
      setProduct(null);
      refresh();
    } catch (cause) {
      setFormError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog ref={productDialog} className="modal-dialog" onClose={() => setProduct(null)}>
      <article className="modal-card">
        <header className="modal-header">
          <h2>{product?._id ? 'Editar producto' : 'Agregar producto'}</h2>
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar"
            onClick={() => productDialog.current?.close()}
          >
            ×
          </button>
        </header>
        <form
          key={product?._id || 'new-product'}
          onSubmit={submitProduct}
          encType="multipart/form-data"
        >
          <input type="hidden" name="id" value={product?._id || ''} />
          <p className="form-field">
            <label htmlFor="prod-name">Nombre del producto</label>
            <input
              id="prod-name"
              name="name"
              defaultValue={product?.name || ''}
              required
              minLength="2"
              maxLength="100"
            />
          </p>
          <p className="form-field">
            <label htmlFor="prod-description">Descripción</label>
            <textarea
              id="prod-description"
              name="description"
              defaultValue={product?.description || ''}
              rows="3"
              required
            />
          </p>
          <fieldset className="form-group-inline">
            <p className="form-field">
              <label htmlFor="prod-price">Precio ($)</label>
              <input
                id="prod-price"
                name="price"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={product?.price || ''}
                required
              />
            </p>
            <p className="form-field">
              <label htmlFor="prod-stock">Stock</label>
              <input
                id="prod-stock"
                name="stock"
                type="number"
                min="0"
                defaultValue={product?.stock ?? ''}
                required
              />
            </p>
          </fieldset>
          <p className="form-field">
            <label htmlFor="prod-category">Categoría</label>
            <select
              id="prod-category"
              name="category"
              defaultValue={product?.category || ''}
              required
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </p>
          <p className="form-field">
            <label htmlFor="prod-image-file">Imagen del producto (opcional)</label>
            <input
              ref={imageFile}
              id="prod-image-file"
              name="imageFile"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setImagePreview(URL.createObjectURL(file));
              }}
            />
          </p>
          <p className="form-field">
            <label htmlFor="prod-image">URL de imagen (si no subes un archivo)</label>
            <input
              id="prod-image"
              name="image"
              type="url"
              defaultValue={product?.image || ''}
              placeholder="https://..."
              onChange={(event) => {
                if (!imageFile.current?.files?.length && event.target.value)
                  setImagePreview(event.target.value);
              }}
            />
          </p>
          <figure className="form-field image-preview-container">
            <figcaption>Vista previa</figcaption>
            <img src={imagePreview} alt="Vista previa del producto" />
          </figure>
          {formError && (
            <output className="form-status error" role="alert">
              {formError}
            </output>
          )}
          <footer className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => productDialog.current?.close()}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar producto'}
            </button>
          </footer>
        </form>
      </article>
    </dialog>
  );
}

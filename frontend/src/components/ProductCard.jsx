import { useState } from 'react';
import { backendAssetUrl } from '../api.js';
import { useCart } from './CartContext.js';

export default function ProductCard({ product }) {
  const { add, notify } = useCart();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const stock = product.availableStock ?? product.stock ?? 0;
  async function addProduct() {
    setBusy(true);
    setError('');
    try {
      await add(product);
      setAdded(true);
      setTimeout(() => setAdded(false), 1000);
    } catch (requestError) {
      setError(requestError.message);
      notify(requestError.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <li>
      <article className="product-card">
        <a
          href={`/producto/${product._id}`}
          className="product-card-link"
          aria-label={`Ver detalles de ${product.name}`}
        >
          <figure className="product-card-media">
            <img
              src={backendAssetUrl(product.image || '/images/products/product-placeholder.svg')}
              alt={product.name}
              loading="lazy"
            />
          </figure>
          <header>
            <h3>{product.name}</h3>
          </header>
          <p className="product-price">${Number(product.price).toFixed(2)}</p>
        </a>
        <footer>
          <button
            type="button"
            className="btn btn-primary add-to-cart-btn"
            disabled={stock === 0 || busy}
            onClick={addProduct}
          >
            <i className={added ? 'ri-check-line' : 'ri-shopping-cart-line'} aria-hidden="true" />
            {stock === 0
              ? 'Agotado'
              : added
                ? '¡Añadido!'
                : busy
                  ? 'Añadiendo…'
                  : 'Agregar al Carrito'}
          </button>
          {error && (
            <small className="form-status error" role="alert">
              {error}
            </small>
          )}
        </footer>
      </article>
    </li>
  );
}

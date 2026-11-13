import { useState } from 'react';
import { productImageSources } from '../../services/productImages.js';
import { useCartActions } from '../cart/CartContext.js';
import FavoriteButton from '../favorites/FavoriteButton.jsx';

export default function ProductCard({ product, featured = false, comparison, showAvailability = false }) {
  const { add, notify } = useCartActions();
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
      <article className={featured ? 'product-card featured-product' : 'product-card'}>
        <a
          href={`/producto/${product._id}`}
          className="product-card-link"
          aria-label={`Ver detalles de ${product.name}`}
        >
          <figure className="product-card-media">
            <img
              {...productImageSources(product.image)}
              sizes="(min-width: 1001px) 25vw, (min-width: 601px) 45vw, 90vw"
              alt={product.name}
              loading="lazy"
            />
          </figure>
          <header>
            {featured && <p className="editorial-kicker">{product.category}</p>}
            <h3>{product.name}</h3>
            {featured && product.description && (
              <p className="featured-description">{product.description}</p>
            )}
            {featured && product.specifications?.length > 0 && (
              <dl className="featured-specs">
                {product.specifications.slice(0, 3).map(({ name, value }) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </header>
          <p className="product-price">${Number(product.price).toFixed(2)}</p>
        </a>
        <footer>
          {showAvailability && <p className="favorite-availability">{stock > 0 ? 'Disponible' : 'Agotado'} · No se reserva al guardar</p>}
          {comparison && (
            <label>
              <input
                type="checkbox"
                checked={comparison.selected}
                disabled={comparison.disabled}
                onChange={() => comparison.toggle(product)}
              />{' '}
              Comparar <span className="sr-only">{product.name}</span>
            </label>
          )}
          <FavoriteButton product={product} />
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

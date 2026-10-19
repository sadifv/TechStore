import { useEffect, useState } from 'react';
import { backendAssetUrl, requestJson } from '../api.js';
import { useCart } from '../components/CartContext.js';

export default function ProductPage({ productId }) {
  const { add, notify } = useCart();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [cartError, setCartError] = useState('');
  useEffect(() => {
    let active = true;
    requestJson(`/api/products/${encodeURIComponent(productId)}`)
      .then((result) => {
        if (active) setProduct(result.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  async function addProduct(event) {
    event.preventDefault();
    setCartError('');
    try {
      await add(product, quantity);
    } catch (requestError) {
      setCartError(requestError.message);
      notify(requestError.message, 'error');
    }
  }

  if (error)
    return (
      <section className="products-section">
        <p className="empty-msg" role="alert">
          {error}
        </p>
        <a href="/catalogo">Volver al catálogo</a>
      </section>
    );
  if (!product)
    return (
      <section className="products-section">
        <p className="empty-msg" role="status">
          Cargando producto...
        </p>
      </section>
    );
  const available = product.availableStock ?? 0;
  const onSale =
    product.flashSale && product.flashSaleEndsAt && new Date(product.flashSaleEndsAt) > new Date();
  return (
    <article className="product-detail-page">
      <figure className="product-detail-media">
        <img
          src={backendAssetUrl(product.image || '/images/products/product-placeholder.svg')}
          alt={product.name}
        />
        {onSale && <span className="product-detail-discount">-{product.flashSaleDiscount}%</span>}
      </figure>
      <section className="product-detail-info">
        <nav aria-label="Navegación">
          <a href="/catalogo" className="product-detail-back">
            ← Volver al catálogo
          </a>
        </nav>
        <p className="product-detail-category">
          <i className="ri-price-tag-3-line" aria-hidden="true" /> {product.category}
        </p>
        <h1 className="product-detail-title">{product.name}</h1>
        {product.description && <p className="product-detail-description">{product.description}</p>}
        <section className="product-detail-price-section" aria-label="Precio">
          {onSale && product.originalPrice != null && (
            <p className="product-detail-price-original">
              <del>${Number(product.originalPrice).toFixed(2)}</del>
            </p>
          )}
          <p className="product-detail-price">${Number(product.price).toFixed(2)}</p>
        </section>
        <section className="product-detail-stock" aria-label="Disponibilidad">
          <p
            id="stock-indicator"
            className={available > 0 ? 'stock-in' : 'stock-out'}
            aria-live="polite"
          >
            <i className="ri-checkbox-circle-line" aria-hidden="true" />
            <span id="stock-label">{available > 0 ? 'En stock' : 'Agotado temporalmente'}</span>
            <span id="stock-separator" aria-hidden="true">
              ·
            </span>
            <span id="stock-count">{available}</span>
            <span id="stock-unit-label">unidades disponibles</span>
          </p>
        </section>
        <form className="product-detail-actions" id="add-to-cart-form" onSubmit={addProduct}>
          <input type="hidden" name="productId" value={product._id} />
          <label htmlFor="quantity" className="sr-only">
            Cantidad
          </label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            value={quantity}
            onChange={(event) =>
              setQuantity(Math.max(1, Math.min(available || 1, Number(event.target.value) || 1)))
            }
            min="1"
            max={available}
            disabled={available === 0}
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={available === 0}>
            <i className="ri-shopping-cart-line" aria-hidden="true" />
            {available === 0 ? 'Producto agotado' : 'Añadir al carrito'}
          </button>
          {cartError && (
            <output className="form-status error" role="alert">
              {cartError}
            </output>
          )}
        </form>
      </section>
    </article>
  );
}

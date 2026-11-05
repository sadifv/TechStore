import { useFavorites } from './FavoritesContext.js';
import { useEffect, useRef } from 'react';
import ProductCard from '../catalog/ProductCard.jsx';
import FavoriteButton from './FavoriteButton.jsx';
export default function FavoritesSection() {
  const f = useFavorites();
  const heading = useRef(null);
  const previousCount = useRef(0);
  const count = f?.items.length || 0;
  useEffect(() => {
    if (previousCount.current > count && document.activeElement === document.body) heading.current?.focus();
    previousCount.current = count;
  }, [count]);
  if (!f?.user) return null;
  return (
    <section className="favorites-section" aria-labelledby="favorites-heading">
      <h2 id="favorites-heading" ref={heading} tabIndex={-1}>Mis favoritos</h2>
      <p>Guarda hasta 100 productos para consultarlos después. Guardarlos no reserva inventario.</p>
      {f.loading ? (
        <p role="status">Cargando favoritos…</p>
      ) : f.error ? (
        <>
          <p role="alert">{f.error}</p>
          <button type="button" className="btn btn-outline" onClick={f.refresh}>
            Reintentar favoritos
          </button>
        </>
      ) : (
        <>
          {!f.items.length && (
            <p>
              Aún no tienes favoritos. <a href="/catalogo">Explorar catálogo</a>
            </p>
          )}
          <ul className="products-grid">
            {f.items.map((product) =>
              product.unavailable ? (
                <li key={product._id}>
                  <article className="order-card">
                    <h3>Producto no disponible</h3>
                    <FavoriteButton product={product} />
                  </article>
                </li>
              ) : (
                <ProductCard key={product._id} product={product} />
              ),
            )}
          </ul>
        </>
      )}
    </section>
  );
}

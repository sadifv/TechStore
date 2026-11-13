import { useFavorites } from './FavoritesContext.js';
import { useEffect, useRef, useState } from 'react';
import ProductCard from '../catalog/ProductCard.jsx';
import FavoriteButton from './FavoriteButton.jsx';

const FAVORITES_PAGE_SIZE = 4;

export default function FavoritesSection() {
  const f = useFavorites();
  const [visibleCount, setVisibleCount] = useState(FAVORITES_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const list = useRef(null);
  const previousVisibleCount = useRef(FAVORITES_PAGE_SIZE);
  const heading = useRef(null);
  const previousCount = useRef(0);
  const count = f?.items.length || 0;
  const normalized = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const matchingItems = (f?.items || []).filter((item) => normalized(item.name || '').includes(normalized(search.trim())));
  useEffect(() => {
    if (previousCount.current > count && document.activeElement === document.body)
      heading.current?.focus();
    previousCount.current = count;
  }, [count]);
  useEffect(() => {
    if (visibleCount > previousVisibleCount.current) {
      list.current?.children[previousVisibleCount.current]?.querySelector('a, button')?.focus();
    }
    previousVisibleCount.current = visibleCount;
  }, [visibleCount]);
  if (!f?.user) return null;
  return (
    <section className="favorites-section" aria-labelledby="favorites-heading">
      <h2 id="favorites-heading" ref={heading} tabIndex={-1}>
        Mis favoritos
      </h2>
      <p>Guarda hasta 100 productos para consultarlos después. Guardarlos no reserva inventario.</p>
      <label className="favorites-search" htmlFor="favorites-search">Buscar en favoritos
        <input id="favorites-search" type="search" value={search} maxLength={100} placeholder="Nombre del producto" onChange={(event) => {
          setSearch(event.target.value);
          previousVisibleCount.current = FAVORITES_PAGE_SIZE;
          setVisibleCount(FAVORITES_PAGE_SIZE);
        }} />
      </label>
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
          <ul className="products-grid" ref={list}>
            {matchingItems.slice(0, visibleCount).map((product) =>
              product.unavailable ? (
                <li key={product._id}>
                  <article className="order-card">
                    <h3>Producto no disponible</h3>
                    <FavoriteButton product={product} />
                  </article>
                </li>
              ) : (
                <ProductCard key={product._id} product={product} showAvailability />
              ),
            )}
          </ul>
          {count > 0 && (
            <p role="status">
              Mostrando {Math.min(visibleCount, matchingItems.length)} de {matchingItems.length} favoritos{search.trim() ? ' encontrados' : ''}.
            </p>
          )}
          {count > 0 && matchingItems.length === 0 && <p>No hay favoritos que coincidan con tu búsqueda.</p>}
          {matchingItems.length > visibleCount && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setVisibleCount((current) => current + FAVORITES_PAGE_SIZE)}
            >
              Ver más favoritos
            </button>
          )}
        </>
      )}
    </section>
  );
}

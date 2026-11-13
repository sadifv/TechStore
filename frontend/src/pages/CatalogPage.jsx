import { useEffect, useState } from 'react';
import { requestJson } from '../services/api.js';
import ProductCard from '../components/catalog/ProductCard.jsx';
import ProductComparison from '../components/catalog/ProductComparison.jsx';
import useCatalogFilters from '../hooks/useCatalogFilters.js';

import { categories } from '../config/storeCatalog.js';

function getVisiblePages(currentPage, totalPages) {
  currentPage = Math.max(1, Math.min(totalPages, currentPage));
  const start = Math.max(2, currentPage - 2);
  const end = Math.min(totalPages - 1, currentPage + 2);
  const pages = [1];
  if (start > 2) pages.push('start-ellipsis');
  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) pages.push(pageNumber);
  if (end < totalPages - 1) pages.push('end-ellipsis');
  if (totalPages > 1) pages.push(totalPages);
  return pages;
}

export default function CatalogPage() {
  const { search, committedSearch, category, sort, page, setSearch, setCategory, setSort, setPage, clearFilters } = useCatalogFilters();
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState({ key: '', products: [], pagination: null });
  const [error, setError] = useState('');
  const [comparison, setComparison] = useState([]);

  function toggleComparison(product) {
    setComparison((current) => {
      if (current.some((item) => item._id === product._id))
        return current.filter((item) => item._id !== product._id);
      if (current.length >= 3 || (current.length && current[0].category !== product.category))
        return current;
      return [...current, product];
    });
  }
  const query = new URLSearchParams({
    page: String(page),
    limit: '8',
    search: committedSearch,
    category,
    sort,
  }).toString();
  const requestKey = `${query}:${retry}`;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    requestJson(`/api/products?${query}`, { signal: controller.signal })
      .then((result) => {
        if (active) {
          setData({ ...result, key: requestKey });
          setError('');
        }
      })
      .catch((requestError) => {
        if (active) {
          setData({ key: requestKey, products: [], pagination: null });
          setError(requestError.message);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [query, requestKey]);

  const loading = data.key !== requestKey;
  const visiblePages = data.pagination ? getVisiblePages(page, data.pagination.totalPages) : [];
  return (
    <section id="catalogo" className="products-section" aria-labelledby="catalog-heading">
      <header className="section-header">
        <h1 id="catalog-heading">Nuestro Catálogo</h1>
        <a className="btn btn-outline" href="/arma-tu-equipo">
          Arma tu equipo
        </a>
      </header>
      {comparison.length > 0 && (
        <ProductComparison products={comparison} clear={() => setComparison([])} />
      )}
      <form
        id="catalog-filters-form"
        className="catalog-filters"
        role="search"
        aria-label="Filtros de catálogo"
        onSubmit={(event) => event.preventDefault()}
      >
        <fieldset className="filter-group search-group">
          <legend className="sr-only">Búsqueda de productos</legend>
          <i className="ri-search-line search-icon" aria-hidden="true" />
          <input
            type="search"
            id="search-input"
            name="search"
            value={search}
            maxLength={100}
            data-filter-active={search.trim() !== ''}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Buscar productos por nombre o descripción..."
            aria-label="Buscar productos"
          />
        </fieldset>
        <fieldset className="filter-group">
          <label htmlFor="category-select">Categoría:</label>
          <select
            id="category-select"
            name="category"
            value={category}
            data-filter-active={category !== 'all'}
            onChange={(event) => {
              setCategory(event.target.value);
            }}
          >
            <option value="all">Todas las categorías</option>
            {categories.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </fieldset>
        <fieldset className="filter-group">
          <label htmlFor="sort-select">Ordenar por:</label>
          <select
            id="sort-select"
            name="sort"
            value={sort}
            data-filter-active={sort !== 'recent'}
            onChange={(event) => {
              setSort(event.target.value);
            }}
          >
            <option value="recent">Más recientes</option>
            <option value="price_asc">Precio: Menor a Mayor</option>
            <option value="price_desc">Precio: Mayor a Menor</option>
            <option value="name_asc">Nombre (A - Z)</option>
          </select>
        </fieldset>
        {(search !== '' || category !== 'all' || sort !== 'recent' || page !== 1) && (
          <button className="btn btn-outline" type="button" onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
      </form>
      <ul id="products-grid" className="products-grid" aria-live="polite">
        {loading ? (
          <li className="empty-state-item">
            <p className="empty-msg">Cargando productos...</p>
          </li>
        ) : error ? (
          <li className="empty-state-item">
            <p className="empty-msg">{error}</p>
            <button className="btn btn-outline" type="button" onClick={() => setRetry((value) => value + 1)}>
              Reintentar
            </button>
          </li>
        ) : data.products.length ? (
          data.products.map((product) => {
            const selected = comparison.some((item) => item._id === product._id);
            return (
              <ProductCard
                key={product._id}
                product={product}
                comparison={{
                  selected,
                  disabled:
                    !selected &&
                    (comparison.length >= 3 ||
                      Boolean(comparison.length && comparison[0].category !== product.category)),
                  toggle: toggleComparison,
                }}
              />
            );
          })
        ) : (
          <li className="empty-state-item">
            <p className="empty-msg">No se encontraron productos con los filtros seleccionados.</p>
          </li>
        )}
      </ul>
      {data.pagination?.totalPages > 1 && (
        <nav
          id="pagination-controls"
          className="pagination-container"
          aria-label="Navegación de páginas"
        >
          {visiblePages.map((number) =>
            typeof number === 'string' ? (
              <span className="pagination-ellipsis" key={number} aria-hidden="true">
                …
              </span>
            ) : (
              <button
                className={number === page ? 'active' : ''}
                key={number}
                type="button"
                aria-current={number === page ? 'page' : undefined}
                onClick={() => setPage(number)}
              >
                {number}
              </button>
            ),
          )}
        </nav>
      )}
    </section>
  );
}

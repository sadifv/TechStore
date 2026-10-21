import { useEffect, useState } from 'react';
import { requestJson } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

const categories = [
  'Laptops',
  'Smartphones',
  'Audio',
  'Accesorios',
  'Periféricos',
  'Monitores',
  'Almacenamiento',
  'Componentes',
  'Gaming',
  'Redes',
];

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
  const searchParams = new URLSearchParams(window.location.search);
  const initialSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [sort, setSort] = useState(searchParams.get('sort') || 'recent');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [data, setData] = useState({ key: '', products: [], pagination: null });
  const [error, setError] = useState('');
  const query = new URLSearchParams({
    page: String(page),
    limit: '8',
    search: debouncedSearch,
    category,
    sort,
  }).toString();

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    requestJson(`/api/products?${query}`, { signal: controller.signal })
      .then((result) => {
        if (active) {
          setData({ ...result, key: query });
          setError('');
        }
      })
      .catch((requestError) => {
        if (active) {
          setData({ key: query, products: [], pagination: null });
          setError(requestError.message);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [query]);

  const loading = data.key !== query;
  const visiblePages = data.pagination ? getVisiblePages(page, data.pagination.totalPages) : [];
  return (
    <section id="catalogo" className="products-section" aria-labelledby="catalog-heading">
      <header className="section-header">
        <h1 id="catalog-heading">Nuestro Catálogo</h1>
      </header>
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
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
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
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
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
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
          >
            <option value="recent">Más recientes</option>
            <option value="price_asc">Precio: Menor a Mayor</option>
            <option value="price_desc">Precio: Mayor a Menor</option>
            <option value="name_asc">Nombre (A - Z)</option>
          </select>
        </fieldset>
      </form>
      <ul id="products-grid" className="products-grid" aria-live="polite">
        {loading ? (
          <li className="empty-state-item">
            <p className="empty-msg">Cargando productos...</p>
          </li>
        ) : error ? (
          <li className="empty-state-item">
            <p className="empty-msg">{error}</p>
          </li>
        ) : data.products.length ? (
          data.products.map((product) => <ProductCard key={product._id} product={product} />)
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

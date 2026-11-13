import { useCallback, useEffect, useState } from 'react';
import { readCatalogFilters, catalogFilterUrl } from '../features/catalog/catalogFilters.js';

export default function useCatalogFilters() {
  const [filters, setFilters] = useState(() => readCatalogFilters(location.search));
  const [search, setSearch] = useState(filters.search);
  const commit = useCallback((next) => {
    const url = catalogFilterUrl(location.href, next);
    if (`${location.pathname}${location.search}${location.hash}` !== url)
      history.pushState(history.state, '', url);
    setFilters(next);
  }, []);

  useEffect(() => {
    const restore = () => {
      const next = readCatalogFilters(location.search);
      setFilters(next);
      setSearch(next.search);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  useEffect(() => {
    const value = search.trim().slice(0, 100);
    if (value === filters.search) return undefined;
    const timeout = setTimeout(() => commit({ ...filters, search: value, page: 1 }), 300);
    return () => clearTimeout(timeout);
  }, [search, filters, commit]);

  return {
    ...filters, search, committedSearch: filters.search, setSearch,
    setCategory: (category) => commit({ ...filters, category, page: 1 }),
    setSort: (sort) => commit({ ...filters, sort, page: 1 }),
    setPage: (page) => commit({ ...filters, page }),
  };
}

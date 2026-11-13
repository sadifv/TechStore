import { categories } from '../../config/storeCatalog.js';

const sorts = ['recent', 'price_asc', 'price_desc', 'name_asc'];
export function readCatalogFilters(search) {
  const params = new URLSearchParams(search);
  const page = Number(params.get('page') || 1);
  return {
    search: (params.get('search') || '').trim().slice(0, 100),
    category: categories.includes(params.get('category')) ? params.get('category') : 'all',
    sort: sorts.includes(params.get('sort')) ? params.get('sort') : 'recent',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function catalogFilterUrl(href, filters) {
  const url = new URL(href);
  for (const key of ['search', 'category', 'sort', 'page']) url.searchParams.delete(key);
  if (filters.search) url.searchParams.set('search', filters.search);
  if (filters.category !== 'all') url.searchParams.set('category', filters.category);
  if (filters.sort !== 'recent') url.searchParams.set('sort', filters.sort);
  if (filters.page !== 1) url.searchParams.set('page', String(filters.page));
  return `${url.pathname}${url.search}${url.hash}`;
}

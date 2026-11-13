import test from 'node:test';
import assert from 'node:assert/strict';
import { readCatalogFilters, catalogFilterUrl } from '../../src/features/catalog/catalogFilters.js';
import { money } from '../../src/utils/formatters.js';

test('normaliza filtros inválidos y limita la búsqueda sin convertirlos en URLs externas', () => {
  assert.deepEqual(readCatalogFilters('?category=unknown&sort=invalid&page=Infinity'), {
    search: '', category: 'all', sort: 'recent', page: 1,
  });
  for (const page of ['-1', '1.5', '9007199254740992', 'invalid'])
    assert.equal(readCatalogFilters(`?page=${page}`).page, 1);
  assert.equal(readCatalogFilters(`?search=${'x'.repeat(200)}`).search.length, 100);
  const url = catalogFilterUrl('https://shop.example.invalid/catalogo?campaign=demo#catalogo', {
    search: 'audio & <script>', category: 'Monitores', sort: 'price_asc', page: 2,
  });
  assert.ok(url.startsWith('/catalogo?'));
  const result = new URL(url, 'https://shop.example.invalid');
  assert.equal(result.searchParams.get('search'), 'audio & <script>');
  assert.equal(result.searchParams.get('campaign'), 'demo');
  assert.equal(result.hash, '#catalogo');
});

test('precios de toda la interfaz usan USD es-EC con agrupación y dos decimales', () => {
  assert.equal(money(1234.56), '$1.234,56');
  assert.equal(money('329'), '$329,00');
  assert.equal(money(null), '$0,00');
  assert.equal(money(Infinity), '$0,00');
});

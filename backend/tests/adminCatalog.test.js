const test = require('node:test');
const assert = require('node:assert/strict');
const { parseListingQuery } = require('../controllers/adminCatalogController');

test('administrative listing bounds input and treats regex metacharacters literally', () => {
  for (const query of [
    { page: '0' },
    { page: '10001' },
    { limit: '51' },
    { limit: ['20'] },
    { q: { $ne: '' } },
    { q: 'x'.repeat(101) },
    { q: 'a\nb' },
    { category: { $ne: '' } },
    { status: 'all' },
    { extra: 'x' },
  ])
    assert.throws(() => parseListingQuery(query, true), { statusCode: 400 });
  assert.equal(parseListingQuery({ q: 'a.*(b)' }, true).filter.name.$regex, 'a\\.\\*\\(b\\)');
  assert.deepEqual(parseListingQuery({ status: 'archived', category: 'Muebles' }, true).filter, {
    archivedAt: { $ne: null },
    category: 'Muebles',
  });
  assert.throws(() => parseListingQuery({ category: 'Audio' }), { statusCode: 400 });
  assert.equal(parseListingQuery({ q: ' Ana ' }).filter.$or[0].name.$regex, 'Ana');
});

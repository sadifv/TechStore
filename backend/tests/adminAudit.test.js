const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAuditQuery, safeChanges } = require('../services/adminAudit');
test('audit filters reject unbounded and malformed input', () => {
  for (const q of [
    { page: '1001' },
    { action: 'unknown' },
    { from: '2026-02-30' },
    { from: '2020-01-01', to: '2026-01-01' },
    { page: ['1'] },
    { extra: 'x' },
  ])
    assert.throws(() => parseAuditQuery(q));
  assert.deepEqual(parseAuditQuery({ page: '2', action: 'product.updated' }).page, 2);
});
test('audit changes contain only typed allowed fields and no personal text', () => {
  assert.deepEqual(
    safeChanges('product.updated', {
      price: 12,
      stock: 3,
      name: 'private',
      password: 'secret',
      specifications: [{ name: 'secret', value: 'secret' }],
    }),
    [
      { field: 'price', after: 12 },
      { field: 'stock', after: 3 },
    ],
  );
  assert.deepEqual(safeChanges('user.role_changed', { role: 'owner', email: 'private' }), []);
});

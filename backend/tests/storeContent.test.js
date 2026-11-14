const test = require('node:test');
const assert = require('node:assert/strict');
const { defaults, normalizeContent } = require('../services/storeContent');

test('store content keeps existing defaults and accepts structured text only', () => {
  assert.deepEqual(normalizeContent({ revision: 0, content: defaults }), defaults);
  assert.deepEqual(normalizeContent({ revision: 2, content: { location: '  Guayaquil  ' } }), {
    location: 'Guayaquil',
  });
  assert.deepEqual(require('../../frontend/src/config/storeContentDefaults.json'), defaults);
});
test('store content rejects arbitrary fields, scripts, unsafe media and mailbox lists', () => {
  for (const content of [
    { css: 'body{}' },
    { heroLead: '<script>alert(1)</script>' },
    { heroLead: 'x\nheader' },
    { heroImage: 'javascript:alert(1)' },
    { heroImage: '//evil.invalid/a.jpg' },
    { heroImage: '/images/../file' },
    { heroImage: 'https://user:pass@example.invalid/photo.jpg' },
    { instagram: 'https://evil.invalid/' },
    { email: 'a@example.invalid,b@example.invalid' },
    { heroLead: '' },
    { heroLead: 'a'.repeat(121) },
    { heroLead: ['hola'] },
  ])
    assert.throws(() => normalizeContent({ revision: 0, content }), { statusCode: 400 });
  for (const body of [
    null,
    {},
    { revision: -1, content: defaults },
    { revision: '0', content: defaults },
    { revision: 0, content: {}, role: 'owner' },
    JSON.parse('{"revision":0,"content":{"__proto__":"x"}}'),
  ])
    assert.throws(() => normalizeContent(body), { statusCode: 400 });
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { configureProxy } from '../scripts/configureProxy.js';

test('build proxy changes only API/uploads destinations and preserves the final SPA rule', async () => {
  const source = await readFile(new URL('../public/_redirects', import.meta.url), 'utf8');
  assert.equal(configureProxy(source), source);
  const result = configureProxy(source, 'https://backend.example.invalid/');
  assert.ok(result.includes('/api/* https://backend.example.invalid/api/:splat 200!'));
  assert.ok(result.includes('/uploads/* https://backend.example.invalid/uploads/:splat 200!'));
  assert.ok(result.trim().endsWith('/* /index.html 200'));
  assert.ok(result.includes('/images/products/product-webcam.svg'));
  for (const invalid of [
    'http://backend.example.invalid',
    'https://user:pass@backend.example.invalid',
    'https://backend.example.invalid/api',
    'https://backend.example.invalid/?key=value',
    'https://backend.example.invalid/#fragment',
  ]) {
    assert.throws(() => configureProxy(source, invalid));
  }
  assert.throws(() => configureProxy('/* /index.html 200', 'https://backend.example.invalid'));
});

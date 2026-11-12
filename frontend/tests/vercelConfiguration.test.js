import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const loadConfig = async () =>
  JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

test('Vercel conserva los destinos API/uploads de Netlify antes del fallback SPA', async () => {
  const config = await loadConfig();
  const redirects = await readFile(new URL('../public/_redirects', import.meta.url), 'utf8');
  for (const prefix of ['api', 'uploads']) {
    const upstream = redirects.match(
      new RegExp(`^/${prefix}/\\*\\s+(https://[^\\s/]+)/${prefix}/:splat`, 'm'),
    )[1];
    const rule = config.rewrites.findIndex(({ source }) => source === `/${prefix}/:path*`);
    assert.ok(rule >= 0);
    assert.equal(config.rewrites[rule].destination, `${upstream}/${prefix}/:path*`);
    assert.ok(rule < config.rewrites.length - 1);
  }
  assert.deepEqual(config.rewrites.at(-1), { source: '/(.*)', destination: '/index.html' });
  assert.equal(config.framework, 'vite');
  assert.equal(config.outputDirectory, 'dist');
  assert.equal(config.installCommand, 'npm ci');
});

test('Vercel mantiene las cabeceras de seguridad y no cachea respuestas API', async () => {
  const config = await loadConfig();
  const source = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
  const headers = config.headers.find(({ source }) => source === '/(.*)').headers;
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s+([A-Za-z-]+):\s*(.+)$/);
    if (match)
      assert.ok(
        headers.some(({ key, value }) => key === match[1] && value === match[2]),
        match[1],
      );
  }
  const apiHeaders = new Map(
    config.headers
      .find(({ source }) => source === '/api/:path*')
      .headers.map(({ key, value }) => [key.toLowerCase(), value]),
  );
  assert.equal(apiHeaders.get('cache-control'), 'no-store');
  assert.equal(apiHeaders.get('x-vercel-enable-rewrite-caching'), '0');
  assert.equal(apiHeaders.get('vercel-cdn-cache-control'), 'no-store');
});

test('Vercel conserva los enlaces de imágenes antiguas sin redirigir las APIs', async () => {
  const config = await loadConfig();
  const netlify = (
    await readFile(new URL('../public/_redirects', import.meta.url), 'utf8')
  ).replaceAll('\r\n', '\n');
  const aliases = [...netlify.matchAll(/^(\/images\/\S+)\s+(\/images\/\S+)\s+(301|302)$/gm)];
  assert.ok(aliases.length > 0);
  for (const [, source, destination, status] of aliases) {
    assert.ok(
      config.redirects.some(
        (rule) =>
          rule.source === source &&
          rule.destination === destination &&
          rule.statusCode === Number(status),
      ),
      source,
    );
  }
  assert.ok(config.redirects.every(({ source }) => source.startsWith('/images/')));
});

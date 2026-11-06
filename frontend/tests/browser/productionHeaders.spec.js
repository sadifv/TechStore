import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures.js';

test('la CSP de producción permite previsualizar archivos sin habilitar scripts blob', async ({
  page,
}) => {
  const headers = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
  const policy = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)[1];
  expect(policy).toMatch(/script-src 'self'(?:;|$)/);
  expect(policy).not.toContain("'unsafe-inline'");
  await page.route('**/csp-preview-test', (route) =>
    route.fulfill({
      contentType: 'text/html',
      headers: { 'Content-Security-Policy': policy },
      body: '<!doctype html><html lang="es"><title>Prueba local de CSP</title><body><img id="preview" alt="Vista previa ficticia"></body></html>',
    }),
  );
  await page.goto('/csp-preview-test');
  const result = await page.evaluate(async () => {
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQ1cAAAAASUVORK5CYII=',
      ),
      (char) => char.charCodeAt(0),
    );
    const url = URL.createObjectURL(new Blob([png], { type: 'image/png' }));
    const image = document.getElementById('preview');
    try {
      return await new Promise((resolve) => {
        image.onload = () => resolve(image.naturalWidth > 0 ? 'loaded' : 'invalid');
        image.onerror = () => resolve('blocked');
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  expect(result).toBe('loaded');
});

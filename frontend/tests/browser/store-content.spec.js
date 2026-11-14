import { test, expect } from './fixtures.js';
import defaults from '../../src/config/storeContentDefaults.json' with { type: 'json' };

test('content preview is local until saving and shares contact data with the footer', async ({
  page,
  mock,
}) => {
  mock.role = 'admin';
  let stored = { ...defaults };
  let revision = 0;
  mock.handlers.set('GET /api/store/content', (route) =>
    route.fulfill({ json: { success: true, content: stored, revision } }),
  );
  mock.handlers.set('PATCH /api/admin/content', (route) => {
    const body = route.request().postDataJSON();
    expect(body.revision).toBe(0);
    stored = body.content;
    revision++;
    return route.fulfill({ json: { success: true, revision } });
  });
  await page.goto('/admin/contenido');

  await page.getByLabel('Horario', { exact: true }).fill('Lunes a viernes, 10:00–15:00');
  await page.getByLabel('Titular', { exact: true }).fill('Elige tu próximo');
  await expect(page.locator('.footer-contact')).not.toContainText('10:00–15:00');
  await expect(page.locator('.store-content-preview')).toContainText('10:00–15:00');
  await page.getByRole('button', { name: 'Guardar contenido de la tienda', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Contenido guardado' })).toBeVisible();
  await expect(page.locator('.footer-contact')).toContainText('10:00–15:00');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Elige tu próximo detalle.');
  await expect(page.locator('#contacto')).toContainText('10:00–15:00');
  await expect(page.locator('.footer-contact')).toContainText('10:00–15:00');
});

test('content conflicts preserve the local draft and load failure cannot save defaults', async ({
  page,
  mock,
}) => {
  mock.role = 'owner';
  mock.handlers.set('PATCH /api/admin/content', (route) =>
    route.fulfill({
      status: 409,
      json: { success: false, error: 'El contenido cambió. Recarga antes de guardar.' },
    }),
  );
  await page.goto('/admin/contenido');

  await page.getByLabel('Titular', { exact: true }).fill('Mi borrador');
  await page.getByRole('button', { name: 'Guardar contenido de la tienda', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Recarga');
  await expect(page.getByLabel('Titular', { exact: true })).toHaveValue('Mi borrador');
  mock.handlers.set('GET /api/admin/content', (route) =>
    route.fulfill({ status: 503, json: { success: false, error: 'No disponible' } }),
  );
  await page.reload();

  await expect(page.getByRole('alert')).toContainText('No disponible');
  await expect(
    page.getByRole('button', { name: 'Guardar contenido de la tienda', exact: true }),
  ).toHaveCount(0);
});

test('a late public content response cannot replace content just saved by staff', async ({
  page,
  mock,
}) => {
  mock.role = 'admin';
  let release;
  mock.handlers.set(
    'GET /api/store/content',
    (route) =>
      new Promise((resolve) => {
        release = async () => {
          await route.fulfill({ json: { success: true, revision: 0, content: defaults } });
          resolve();
        };
      }),
  );
  mock.handlers.set('PATCH /api/admin/content', (route) =>
    route.fulfill({ json: { success: true, revision: 1 } }),
  );
  await page.goto('/admin/contenido');

  await page.getByLabel('Horario', { exact: true }).fill('Horario recién guardado');
  await page.getByRole('button', { name: 'Guardar contenido de la tienda', exact: true }).click();
  await expect(page.locator('.footer-contact')).toContainText('Horario recién guardado');
  const response = page.waitForResponse((url) => url.url().endsWith('/api/store/content'));
  await release();
  await response;
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.locator('.footer-contact')).toContainText('Horario recién guardado');
});

for (const theme of ['normal', 'halloween', 'christmas']) {
  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`store editor fits ${width}px in ${theme}`, async ({ page, mock }, testInfo) => {
      mock.role = 'owner';
      mock.theme = theme;
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/admin/contenido');
      await expect(page.locator('.logo-intro')).toBeHidden();

      await expect(page.getByLabel('Titular', { exact: true })).toBeVisible();
      await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width);
      await page.getByLabel('Titular', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`content-${theme}.png`) });
    });
  }
}

import { expect, test } from './fixtures.js';

test('el propietario guarda una colección que puede ver un visitante', async ({ page, mock }) => {
  let selection;
  mock.role = 'owner';
  mock.handlers.set('PATCH /api/admin/collections', async (route) => {
    selection = route.request().postDataJSON();
    await route.fulfill({ json: { success: true } });
  });
  mock.handlers.set('GET /api/store/collections', (route) =>
    route.fulfill({
      json: { success: true, collections: selection ? { setup: [mock.product] } : {} },
    }),
  );
  await page.goto('/admin/colecciones');

  await page.getByRole('checkbox', { name: mock.product.name }).check();
  await page.getByRole('button', { name: 'Guardar colección' }).click();
  await expect(page.getByText('Colección guardada.')).toBeVisible();
  expect(selection).toEqual({ key: 'setup', ids: [mock.product._id] });
  mock.role = 'guest';
  await page.goto('/');
  await page.locator('.home-collections-slot').scrollIntoViewIfNeeded();
  const collection = page.getByRole('region', { name: 'Colecciones TechStore' });
  await expect(
    collection.getByRole('link', { name: `Ver detalles de ${mock.product.name}` }),
  ).toBeVisible();
});

test('la galería cambia de foto y permite ampliarla y cerrarla', async ({ page, mock }) => {
  mock.product.gallery = ['/images/hero-tech.jpg'];
  await page.goto(`/producto/${mock.product._id}`);
  await page.getByRole('button', { name: 'Ver foto 2' }).click();
  await expect(page.locator('.product-detail-media img')).toHaveAttribute(
    'src',
    mock.product.gallery[0],
  );
  await page.getByRole('button', { name: 'Ampliar foto' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

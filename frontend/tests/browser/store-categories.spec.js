import { test, expect } from './fixtures.js';

const entries = [
  {
    id: 'category-1',
    name: 'Portátiles',
    image: '/images/products/catalog-fallback.jpg',
    order: 0,
    aliases: ['Laptops'],
  },
  { id: 'category-12', name: 'Muebles', image: '', order: 1, aliases: [] },
];
test('catalog resolves previous category names and keeps unknown current filters visible', async ({
  page,
  mock,
}) => {
  mock.handlers.set('GET /api/store/categories', (route) =>
    route.fulfill({ json: { success: true, revision: 1, categories: entries } }),
  );
  await page.goto('/catalogo?category=Laptops');
  await expect(page.getByLabel('Categoría:', { exact: true })).toHaveValue('Portátiles');
  await expect
    .poll(() =>
      mock.requests.some(
        (item) =>
          item.key === 'GET /api/products' &&
          new URL(item.url).searchParams.get('category') === 'Portátiles',
      ),
    )
    .toBe(true);
  await page.goto('/catalogo?category=Especial');
  await expect(page.getByLabel('Categoría:', { exact: true })).toHaveValue('Especial');
});

test('category editor previews, reorders and saves structured settings', async ({ page, mock }) => {
  mock.role = 'owner';
  mock.handlers.set('GET /api/store/categories', (route) =>
    route.fulfill({ json: { success: true, revision: 1, categories: entries } }),
  );
  mock.handlers.set('GET /api/admin/categories', (route) =>
    route.fulfill({ json: { success: true, revision: 1, categories: entries } }),
  );
  let saved;
  mock.handlers.set('PATCH /api/admin/categories', (route) => {
    saved = route.request().postDataJSON();
    return route.fulfill({ json: { success: true, revision: 2, categories: saved.categories } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/categorias');

  const settings = page.locator('.category-settings');
  await settings.getByRole('button', { name: 'Editar categoría', exact: true }).click();
  await settings.getByLabel('Nombre', { exact: true }).fill('Portátiles y laptops');
  await settings.getByRole('button', { name: 'Bajar categoría' }).click();
  await settings.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(settings.getByRole('status')).toContainText('Categorías guardadas');
  expect(saved.categories.map((entry) => entry.name)).toEqual(['Muebles', 'Portátiles y laptops']);
  expect(saved.categories[0].order).toBe(0);
  expect(saved.categories[1].order).toBe(1);
  expect(saved.categories[1].aliases).toBeUndefined();
});

test('category modes cancel drafts, create and confirm deletion without publishing edits', async ({
  page,
  mock,
}) => {
  mock.role = 'owner';
  let stored = entries;
  let revision = 1;
  const writes = [];
  mock.handlers.set('GET /api/admin/categories', (route) =>
    route.fulfill({ json: { success: true, revision, categories: stored } }),
  );
  mock.handlers.set('PATCH /api/admin/categories', (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    stored = body.categories;
    return route.fulfill({ json: { success: true, revision: ++revision, categories: stored } });
  });
  await page.goto('/admin/categorias');
  const editor = page.locator('.category-settings');
  await expect(editor.getByRole('button')).toHaveCount(2);
  await editor.getByRole('button', { name: 'Editar categoría', exact: true }).click();
  await expect(editor.getByLabel('Nombre', { exact: true })).toBeFocused();
  await editor.getByLabel('Nombre', { exact: true }).fill('Borrador');
  await editor.getByRole('button', { name: 'Bajar categoría' }).click();
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(writes).toHaveLength(0);
  await expect(editor.getByRole('button', { name: 'Editar categoría', exact: true })).toBeFocused();
  await editor.getByRole('button', { name: 'Añadir categoría', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Eliminar categoría', exact: true })).toHaveCount(
    0,
  );
  await expect(editor.getByRole('button', { name: 'Subir categoría' })).toHaveCount(0);
  await editor.getByLabel('Nombre', { exact: true }).fill('Café');
  await editor.getByRole('button', { name: 'Crear categoría', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Editar categoría', exact: true })).toBeVisible();
  expect(writes[0].categories.map((e) => e.name)).toEqual(['Portátiles', 'Muebles', 'Café']);
  await editor.getByRole('button', { name: 'Editar categoría', exact: true }).click();
  await editor.getByLabel('Nombre', { exact: true }).fill('No publicar');
  page.once('dialog', (dialog) => dialog.dismiss());
  await editor.getByRole('button', { name: 'Eliminar categoría', exact: true }).click();
  expect(writes).toHaveLength(1);
  page.once('dialog', (dialog) => dialog.accept());
  await editor.getByRole('button', { name: 'Eliminar categoría', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Editar categoría', exact: true })).toBeVisible();
  expect(writes[1].categories.map((e) => e.name)).toEqual(['Portátiles', 'Muebles']);
});

test('failed saves preserve draft and reload locks editing', async ({ page, mock }) => {
  mock.role = 'owner';
  let count = 0;
  let release;
  mock.handlers.set('GET /api/admin/categories', async (route) => {
    if (++count > 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    return route.fulfill({ json: { success: true, revision: count, categories: entries } });
  });
  mock.handlers.set('PATCH /api/admin/categories', (route) =>
    route.fulfill({ status: 409, json: { error: 'Recarga antes de guardar.' } }),
  );
  await page.goto('/admin/categorias');
  const editor = page.locator('.category-settings');
  await editor.getByRole('button', { name: 'Editar categoría', exact: true }).click();
  await editor.getByLabel('Nombre', { exact: true }).fill('Mi borrador');
  await editor.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Recarga');
  await expect(editor.getByLabel('Nombre', { exact: true })).toHaveValue('Mi borrador');
  page.once('dialog', (dialog) => dialog.accept());
  await editor.getByRole('button', { name: 'Recargar categorías', exact: true }).click();
  await expect(editor.getByLabel('Nombre', { exact: true })).toBeDisabled();
  await expect.poll(() => Boolean(release)).toBe(true);
  release();
  await expect(editor.getByRole('button', { name: 'Editar categoría', exact: true })).toBeVisible();
});

for (const theme of ['normal', 'halloween', 'christmas']) {
  for (const width of [320, 1440]) {
    test('category visual states ' + theme + ' ' + width, async ({ page, mock }, testInfo) => {
      mock.role = 'owner';
      mock.theme = theme;
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/admin/categorias');
      await expect(page.locator('.logo-intro')).toBeHidden();
      const editor = page.locator('.category-settings');
      await expect(
        editor.getByRole('button', { name: 'Editar categoría', exact: true }),
      ).toBeEnabled();
      await page.screenshot({ path: testInfo.outputPath('browse.png') });
      await editor.getByRole('button', { name: 'Editar categoría', exact: true }).click();
      await expect(editor.getByLabel('Nombre', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: testInfo.outputPath('edit.png'), fullPage: true });
    });
  }
}

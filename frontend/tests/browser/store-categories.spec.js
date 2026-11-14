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
  await settings.getByLabel('Nombre', { exact: true }).fill('Portátiles y laptops');
  await settings.getByRole('button', { name: 'Bajar categoría' }).click();
  await settings.getByRole('button', { name: 'Guardar categorías' }).click();
  await expect(settings.getByRole('status')).toContainText('Categorías guardadas');
  expect(saved.categories.map((entry) => entry.name)).toEqual(['Muebles', 'Portátiles y laptops']);
  expect(saved.categories[0].order).toBe(0);
  expect(saved.categories[1].order).toBe(1);
  expect(saved.categories[1].aliases).toBeUndefined();
});

test('category reload locks editing until the response arrives', async ({ page, mock }) => {
  mock.role = 'owner';
  let release;
  let count = 0;
  mock.handlers.set('GET /api/admin/categories', async (route) => {
    if (++count > 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    return route.fulfill({ json: { success: true, revision: count, categories: entries } });
  });
  await page.goto('/admin/categorias');

  const editor = page.locator('.category-settings');
  await expect(editor.getByLabel('Nombre', { exact: true })).toBeEnabled();
  page.on('dialog', (dialog) => dialog.accept());
  await editor.getByRole('button', { name: 'Recargar categorías' }).click();
  await expect(editor.getByText('Cargando categorías…')).toBeVisible();
  await expect(editor.getByLabel('Nombre', { exact: true })).toBeDisabled();
  await expect(editor.getByRole('button', { name: 'Guardar categorías' })).toBeDisabled();
  await expect.poll(() => Boolean(release)).toBe(true);
  release();
  await expect(editor.getByLabel('Nombre', { exact: true })).toBeEnabled();
});

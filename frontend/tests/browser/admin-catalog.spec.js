import { test, expect, product } from './fixtures.js';

test('admin encuentra productos fuera de la primera página y restaura sin editar stock', async ({
  page,
  mock,
}) => {
  mock.role = 'admin';
  const products = Array.from({ length: 22 }, (_, index) => ({
    ...product,
    _id: index.toString(16).padStart(24, '0'),
    name: `Producto fixture ${index + 1}`,
  }));
  let archived = [
    { ...product, name: 'Producto archivado', archivedAt: '2026-01-01T00:00:00.000Z' },
  ];
  mock.handlers.set('GET /api/admin/products', (route) => {
    const query = new URL(route.request().url()).searchParams;
    let items = query.get('status') === 'archived' ? archived : products;
    if (query.get('q')) items = items.filter((item) => item.name.includes(query.get('q')));
    const currentPage = Number(query.get('page') || 1);
    return route.fulfill({
      json: {
        success: true,
        data: {
          products: items.slice((currentPage - 1) * 20, currentPage * 20),
          pagination: {
            currentPage,
            totalPages: Math.max(1, Math.ceil(items.length / 20)),
            totalCount: items.length,
          },
        },
      },
    });
  });
  mock.handlers.set('GET /api/admin/messages', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          messages: [],
          pagination: { currentPage: 1, totalPages: 1, totalCount: 0 },
        },
      },
    }),
  );
  mock.handlers.set(`PATCH /api/admin/products/${product._id}/restore`, (route) => {
    archived = [];
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/admin/dashboard');
  await expect(page.locator('.logo-intro')).toBeHidden();
  const catalog = page.locator('.dashboard-products');
  await expect(catalog.getByText('22 productos encontrados.', { exact: true })).toBeVisible();
  await catalog.getByRole('button', { name: 'Siguiente »', exact: true }).click();
  await expect(catalog.getByText('Producto fixture 22', { exact: true })).toBeVisible();
  await catalog.getByRole('searchbox', { name: 'Buscar producto', exact: true }).fill('fixture 22');
  await catalog.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(catalog.getByText('1 productos encontrados.', { exact: true })).toBeVisible();
  await catalog.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await catalog
    .getByRole('combobox', { name: 'Estado del catálogo', exact: true })
    .selectOption('archived');
  await expect(catalog.getByText('Producto archivado', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await catalog.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(catalog.getByText('0 productos encontrados.', { exact: true })).toBeVisible();
  const request = mock.requests.find((item) => item.key.startsWith('PATCH /api/admin/products/'));
  expect(request.body).toBeNull();
});

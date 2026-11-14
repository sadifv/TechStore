import { test, expect, product } from './fixtures.js';

for (const width of [320, 390]) {
  test(`especificaciones, editor e historial usables sin desborde a ${width}px`, async ({
    page,
    mock,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    mock.role = 'owner';
    mock.handlers.set('GET /api/admin/audit', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            events: [],
            startedAt: null,
            pagination: { currentPage: 1, totalPages: 1, totalCount: 0 },
          },
        },
      }),
    );
    const noOverflow = async () => {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    };
    await page.goto(`/producto/${product._id}`);
    await expect(page.getByRole('heading', { name: 'Especificaciones técnicas' })).toBeVisible();
    await noOverflow();
    await page.goto('/admin/dashboard');
    await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir característica', exact: true }).click();
    await expect(page.getByLabel('Nombre de característica 1', { exact: true })).toBeFocused();
    await page.getByLabel('Nombre de característica 1', { exact: true }).fill('Panel');
    await page.getByLabel('Valor de característica 1', { exact: true }).fill('IPS');
    await noOverflow();
    await page.getByRole('button', { name: 'Eliminar característica 1', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Añadir característica', exact: true }),
    ).toBeFocused();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.locator('.admin-navigation > summary').click();
    await page.getByRole('link', { name: 'Historial administrativo', exact: true }).click();
    await expect(page.getByText('No hay acciones para los filtros seleccionados.')).toBeVisible();
    await page.getByLabel('Acción', { exact: true }).selectOption('product.updated');
    await page.getByRole('button', { name: 'Filtrar historial', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Actualizar historial', exact: true }),
    ).toBeVisible();
    await noOverflow();
  });
}

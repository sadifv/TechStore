import { test, expect } from './fixtures.js';

for (const width of [390, 1440]) {
  test(`Crea tu selección solo tiene acceso desde catálogo a ${width}px`, async ({
    page,
    mock,
  }) => {
    mock.theme = 'normal';
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/catalogo');
    const navigation = page.getByRole('navigation', { name: 'Navegación principal', exact: true });
    await expect(navigation.locator('a[href="/arma-tu-equipo"]')).toHaveCount(0);
    await page.getByRole('link', { name: 'Crea tu selección', exact: true }).click();
    await expect(page).toHaveURL(/\/arma-tu-equipo$/);
    await expect(
      page.getByRole('heading', { name: 'Crea tu selección', exact: true }),
    ).toBeVisible();
    await page.goto('/');
    await expect(page.locator('.build-experience')).toBeVisible();
    await expect(page.locator('a[href="/arma-tu-equipo"]')).toHaveCount(0);
    await page.getByRole('link', { name: 'Explorar componentes', exact: true }).click();
    await expect(page.getByLabel('Categoría:', { exact: true })).toHaveValue('Componentes');
  });
}

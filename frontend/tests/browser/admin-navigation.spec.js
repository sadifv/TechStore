import { test, expect } from './fixtures.js';

const editorRoutes = [
  ['/admin/contenido', 'Contenido de la tienda', 'Contenido de la tienda'],
  ['/admin/categorias', 'Categorías', 'Administrar categorías'],
  ['/admin/colecciones', 'Colecciones de portada', 'Colecciones de la portada'],
];

for (const theme of ['normal', 'halloween', 'christmas']) {
  for (const width of [390, 1440]) {
    test(`administración con navegación compartida ${theme} a ${width}px`, async ({
      page,
      mock,
    }, testInfo) => {
      mock.role = 'owner';
      mock.theme = theme;
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/admin/dashboard');
      await expect(page.locator('.logo-intro')).toBeHidden();
      await expect(page.locator('.admin-workspace .collection-settings')).toHaveCount(0);
      const sidebar = page.getByRole('navigation', {
        name: 'Navegación administrativa',
        exact: true,
      });
      if (width < 1100) {
        await expect(sidebar).toBeHidden();
        await page.locator('.admin-navigation > summary').click();
      } else {
        const work = await page.locator('.admin-workspace').boundingBox();
        const side = await page.locator('.admin-sidebar').boundingBox();
        expect(side.x).toBeGreaterThanOrEqual(work.x + work.width);
      }
      await expect(
        sidebar.getByRole('link', { name: 'Panel general', exact: true }),
      ).toHaveAttribute('aria-current', 'page');
      for (const [path, label, heading] of editorRoutes) {
        await sidebar.getByRole('link', { name: label, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(
          page.getByRole('heading', { name: heading, level: 1, exact: true }),
        ).toBeVisible();
        await expect(page.locator('.logo-intro')).toBeHidden();
        await expect(page.locator('.admin-workspace details.collection-settings')).toHaveCount(0);
        await expect(
          page.getByRole('link', { name: '← Volver al panel', exact: true }),
        ).toHaveAttribute('href', '/admin/dashboard');
        if (width < 1100) await page.locator('.admin-navigation > summary').click();
        await expect(sidebar.getByRole('link', { name: label, exact: true })).toHaveAttribute(
          'aria-current',
          'page',
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
      await page.screenshot({ path: testInfo.outputPath(`admin-${theme}-${width}.png`) });
    });
  }
}

for (const role of ['guest', 'user']) {
  test(`editores no cargan datos administrativos para ${role}`, async ({ page, mock }) => {
    mock.role = role;
    for (const [path] of editorRoutes) {
      await page.goto(path);
      await expect(
        page.getByRole('heading', { name: 'Acceso administrativo requerido' }),
      ).toBeVisible();
      await expect(page.locator('.admin-sidebar')).toHaveCount(0);
    }
    expect(mock.requests.some(({ key }) => key.startsWith('GET /api/admin/'))).toBe(false);
  });
}

test('admin conserva el menú y no recibe el acceso de historial del owner', async ({
  page,
  mock,
}) => {
  mock.role = 'admin';
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/contenido');
  const nav = page.getByRole('navigation', { name: 'Navegación administrativa', exact: true });
  await expect(nav.getByRole('link', { name: 'Contenido de la tienda' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Historial administrativo' })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Categorías', exact: true }).focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav).toBeHidden();
  await expect(page.locator('.admin-navigation > summary')).toBeFocused();
  await page.locator('.admin-navigation > summary').click();
  await expect(nav).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(nav).toBeVisible();
});

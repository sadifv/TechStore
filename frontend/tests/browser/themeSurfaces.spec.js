import { test, expect } from './fixtures.js';
import { checkContrast } from './contrast.js';

// Complement the product/cart/chat tests with informational, account and editor routes.
for (const theme of ['normal', 'halloween', 'christmas']) {
  test(`superficies de formularios, cuenta y editores: ${theme}`, async ({ page, mock }) => {
    mock.role = 'owner';
    mock.theme = theme;
    mock.handlers.set('GET /api/orders', (route) =>
      route.fulfill({ json: { success: true, orders: [] } }),
    );
    mock.handlers.set('GET /api/addresses', (route) =>
      route.fulfill({ json: { success: true, data: { addresses: [], defaultAddressId: null } } }),
    );
    for (const resource of ['orders', 'users', 'reviews', 'audit', 'marketing']) {
      mock.handlers.set(`GET /api/admin/${resource}`, (route) =>
        route.fulfill({
          json: {
            success: true,
            data: {
              orders: [],
              users: [],
              reviews: [],
              events: [],
              coupons: [],
              campaigns: [],
              pagination: { currentPage: 1, totalPages: 1, totalCount: 0 },
            },
          },
        }),
      );
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        '/register',
        '/forgot-password',
        '/legal',
        '/error',
        '/profile',
        '/admin/contenido',
        '/admin/categorias',
        '/admin/colecciones',
        '/admin/orders',
        '/admin/users',
        '/admin/reviews',
        '/admin/audit',
        '/admin/marketing',
      ]) {
        await page.goto(path);
        await expect(page.locator('main h1').first()).toBeVisible();
        await expect(page.locator('.logo-intro')).toBeHidden();
        // Include content below the fold; exclude hidden/disabled controls and decorative icons.
        const samples = await page
          .locator('main :is(h1,h2,h3,p,label,legend,a,button,input,textarea,select,summary)')
          .evaluateAll((nodes) =>
            nodes
              .filter(
                (node) =>
                  node.getClientRects().length &&
                  !node.disabled &&
                  getComputedStyle(node).visibility === 'visible' &&
                  !node.closest('[inert], [aria-hidden="true"]') &&
                  !node.classList.contains('password-toggle'),
              )
              .map((node, index) => {
                node.setAttribute('data-contrast-sample', index);
                return `[data-contrast-sample="${index}"]`;
              }),
          );
        await checkContrast(page, samples);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          path,
        ).toBe(true);
      }
    }
  });
}

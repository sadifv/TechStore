import { test, expect } from './fixtures.js';

test('las colecciones esperan a que su sección esté cerca de la pantalla', async ({
  page,
  mock,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#featured-grid .product-card')).toBeVisible();
  await page.waitForTimeout(500);
  expect(mock.requests.filter(({ key }) => key === 'GET /api/store/collections')).toHaveLength(0);
  await page.locator('.home-collections-slot').scrollIntoViewIfNeeded();
  await expect
    .poll(() => mock.requests.filter(({ key }) => key === 'GET /api/store/collections').length)
    .toBe(1);
});

test('la estructura inferior existe antes de recorrerla y el contacto conserva su ancla', async ({
  page,
  mock,
}) => {
  mock.role = 'guest';
  await page.goto('/');
  await expect(page.locator('.build-experience')).toBeAttached();
  await expect(page.locator('#contacto')).toBeAttached();
  await page.goto('/#contacto');
  await expect(page.locator('#contacto')).toBeInViewport();
  await expect(page.locator('#contacto h2')).toBeVisible();
});

test('sin IntersectionObserver las colecciones siguen disponibles', async ({ page, mock }) => {
  await page.addInitScript(() => {
    delete window.IntersectionObserver;
  });
  await page.goto('/');
  await expect
    .poll(() => mock.requests.filter(({ key }) => key === 'GET /api/store/collections').length)
    .toBe(1);
});

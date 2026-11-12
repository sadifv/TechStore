import { test, expect, product } from './fixtures.js';

const order = {
  _id: 'cccccccccccccccccccccccc',
  createdAt: '2026-11-01T12:00:00Z',
  status: 'pending',
  paymentStatus: 'pending',
  paymentMethod: 'whatsapp',
  totalAmount: 329,
  canCancel: true,
  expiresAt: '2026-12-01T12:00:00Z',
  items: [{ product, name: product.name, price: 329, quantity: 1 }],
  events: [],
};

for (const [theme, width] of [
  ['normal', 320],
  ['halloween', 390],
  ['christmas', 1440],
]) {
  test(`mi cuenta ordena secciones y conserva detalles y favoritos en ${theme}`, async ({
    page,
    mock,
  }, testInfo) => {
    mock.role = 'user';
    mock.theme = theme;
    const favorites = Array.from({ length: 10 }, (_, index) => ({
      ...product,
      _id: index.toString(16).padStart(24, '0'),
      name: `Favorito ${index + 1}: Monitor ultrawide para trabajo y videojuegos con accesorios`,
    }));
    mock.handlers.set('GET /api/orders', (route) =>
      route.fulfill({ json: { success: true, orders: [order] } }),
    );
    mock.handlers.set('GET /api/addresses', (route) =>
      route.fulfill({
        json: { success: true, data: { addresses: [], defaultAddressId: null } },
      }),
    );
    mock.handlers.set('GET /api/favorites', (route) =>
      route.fulfill({
        json: { success: true, items: favorites, ids: favorites.map((item) => item._id) },
      }),
    );
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/profile');
    await expect(page.getByRole('navigation', { name: 'Secciones de mi cuenta' })).toBeVisible();
    const headings = await page.locator('.profile-container h2').allTextContents();
    expect(headings).toEqual(['Historial de Compras', 'Mis favoritos', 'Mis direcciones']);
    const card = page.locator('.orders-list .order-card');
    await expect(
      card
        .locator('.profile-order-summary')
        .getByText('Pendiente de confirmación', { exact: true }),
    ).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Seguimiento del pedido' })).not.toBeVisible();
    await card.getByText('Ver detalles', { exact: true }).click();
    await expect(card.getByRole('heading', { name: 'Seguimiento del pedido' })).toBeVisible();
    await expect(card.getByRole('button', { name: /Cancelar/ }).first()).toBeVisible();
    await page.locator('.order-details summary').click();
    await expect(card.getByRole('heading', { name: 'Seguimiento del pedido' })).not.toBeVisible();
    const favoritesSection = page.locator('.favorites-section');
    await expect(favoritesSection.locator('.products-grid > li')).toHaveCount(4);
    const columns = await favoritesSection.locator('.products-grid').evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width < 521 ? 1 : 4);
    await expect(page.getByRole('button', { name: 'Recargar direcciones', exact: true })).toBeVisible();
    const addressReads = mock.requests.filter(({ key }) => key === 'GET /api/addresses').length;
    await page.getByRole('button', { name: 'Recargar direcciones', exact: true }).click();
    await expect.poll(() => mock.requests.filter(({ key }) => key === 'GET /api/addresses').length)
      .toBe(addressReads + 1);
    if (width === 1440) {
      for (const [screenWidth, expectedColumns] of [[520, 1], [521, 2], [1000, 2], [1001, 4]]) {
        await page.setViewportSize({ width: screenWidth, height: 844 });
        await expect.poll(() => favoritesSection.locator('.products-grid').evaluate((element) =>
          getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(expectedColumns);
      }
      await page.setViewportSize({ width, height: 844 });
    }
    const contrast = await page
      .locator('.profile-details p')
      .first()
      .evaluate((element) => {
        const luminance = (color) =>
          color
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number)
            .map((value) => value / 255)
            .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
            .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
        const foreground = luminance(getComputedStyle(element).color);
        const background = luminance(
          getComputedStyle(element.closest('.profile-card')).backgroundColor,
        );
        return (
          (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
        );
      });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath('profile.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await favoritesSection.getByRole('button', { name: /Ver más/ }).click();
    await expect(favoritesSection.locator('.products-grid > li')).toHaveCount(8);
    await expect(favoritesSection.getByRole('status')).toContainText('8 de 10');
    await expect(favoritesSection.locator('.products-grid > li').nth(4).locator('a').first()).toBeFocused();
    await favoritesSection.getByRole('button', { name: /Ver más/ }).click();
    await expect(favoritesSection.locator('.products-grid > li')).toHaveCount(10);
    await expect(favoritesSection.getByRole('status')).toContainText('10 de 10');
    await expect(
      favoritesSection.locator('.products-grid > li').nth(8).locator('a').first(),
    ).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('mi cuenta reintenta errores y conserva actualización y cancelación confirmada', async ({
  page,
  mock,
}) => {
  mock.role = 'user';
  let failed = true;
  mock.handlers.set('GET /api/orders', (route) =>
    route.fulfill(
      failed
        ? { status: 503, json: { success: false, error: 'Error de prueba' } }
        : { json: { success: true, orders: [order] } },
    ),
  );
  mock.handlers.set('GET /api/addresses', (route) =>
    route.fulfill({
      json: { success: true, data: { addresses: [], defaultAddressId: null } },
    }),
  );
  mock.handlers.set('POST /api/orders/track', (route) =>
    route.fulfill({ json: { success: true, data: order } }),
  );
  mock.handlers.set('POST /api/orders/cancel', (route) =>
    route.fulfill({
      json: { success: true, data: { ...order, status: 'cancelled', canCancel: false } },
    }),
  );
  await page.goto('/profile');
  await expect(page.getByRole('alert')).toHaveText('Error de prueba');
  failed = false;
  await page.getByRole('button', { name: 'Reintentar carga' }).click();
  await page.locator('.order-details summary').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Actualizar seguimiento' }).click();
  await expect(page.getByText('Seguimiento actualizado.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar pedido', exact: true }).click();
  expect(mock.requests.filter(({ key }) => key === 'POST /api/orders/cancel')).toHaveLength(0);
  await page.getByRole('button', { name: 'Sí, cancelar pedido', exact: true }).click();
  await expect(page.locator('.order-header')).toContainText('Cancelado');
  await expect(page.getByRole('button', { name: 'Cancelar pedido', exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Tu pedido se canceló correctamente.', { exact: true }),
  ).toBeVisible();
});

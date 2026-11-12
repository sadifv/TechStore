import { test, expect, product } from './fixtures.js';

test.use({ hasTouch: true, isMobile: true });

async function scrollCheckout(page, dialog, width, distance) {
  if (width >= 768) {
    await dialog.hover();
    await page.mouse.wheel(0, distance);
    return;
  }
  const bounds = await dialog.boundingBox();
  const session = await page.context().newCDPSession(page);
  try {
    const x = bounds.x + bounds.width / 2;
    const travel = Math.min(180, bounds.height / 2);
    const direction = Math.sign(distance);
    for (let swipe = 0; swipe < Math.ceil(Math.abs(distance) / travel); swipe++) {
      const startY = bounds.y + bounds.height / 2 + direction * travel / 2;
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart', touchPoints: [{ x, y: startY }],
      });
      for (let step = 1; step <= 6; step++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x, y: startY - direction * travel * step / 6 }],
        });
        await page.evaluate(() => new Promise(requestAnimationFrame));
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      // Stop swiping once the edge is reached instead of spending time on inert gestures.
      const atEdge = await dialog.evaluate((element, direction) => direction > 0
        ? element.scrollTop + element.clientHeight >= element.scrollHeight - 1
        : element.scrollTop <= 0, direction);
      if (atEdge) break;
    }
  } finally {
    await session.detach();
  }
}

for (const theme of ['normal', 'halloween', 'christmas']) {
  test(`las fotos conservan sus colores en ${theme}`, async ({ page, mock }) => {
    mock.theme = theme;
    mock.product.gallery = ['/images/products/catalog-fallback.jpg?second'];
    await page.goto(`/producto/${product._id}`);
    await expect(page.locator('.product-detail-media img')).toHaveCSS('mix-blend-mode', 'normal');
    await expect(page.locator('.featured-thumbnails img').first()).toHaveCSS('mix-blend-mode', 'normal');
    await page.getByRole('button', { name: 'Ver foto 2', exact: true }).click();
    await page.getByRole('button', { name: 'Ampliar foto' }).click();
    await expect(page.locator('.gallery-dialog img')).toHaveCSS('mix-blend-mode', 'normal');
  });
}

const checkoutCases = [
  ['normal', 320],
  ['halloween', 390],
  ['christmas', 1440],
].flatMap(([theme, width]) => ['guest', 'user'].map((role) => ({ theme, width, role })));

for (const { theme, width, role } of checkoutCases) {
  test(`checkout ${role} ${theme} a ${width}px permite llegar al final sin desplazar el fondo`, async ({ page, mock }) => {
    mock.theme = theme;
    mock.role = role;
    mock.handlers.set('GET /api/addresses', (route) => route.fulfill({
      json: { success: true, data: { addresses: [], defaultAddressId: null } },
    }));
    if (role === 'user') mock.handlers.set('GET /api/cart', (route) => route.fulfill({
      json: { success: true, items: [{ product, productId: product._id, quantity: 1 }] },
    }));
    await page.setViewportSize({ width, height: 600 });
    await page.goto(`/producto/${product._id}`);
    if (role === 'guest') await page.getByRole('button', { name: 'Añadir al carrito', exact: true }).click();
    if (width < 768) await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
    await page.getByRole('button', { name: 'Ver carrito, 1 productos' }).click();
    await page.getByRole('button', { name: 'Proceder al Pago', exact: true }).click();
    const dialog = page.locator('#checkout-modal');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('overflow-y', 'auto');
    const backgroundY = await page.evaluate(() => scrollY);
    await page.setViewportSize({ width, height: 400 });
    await scrollCheckout(page, dialog, width, 2000);
    const submit = dialog.getByRole('button', { name: 'Continuar por WhatsApp' });
    await expect(submit).toBeInViewport();
    expect(await dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await scrollCheckout(page, dialog, width, 2000);
    expect(await page.evaluate(() => scrollY)).toBe(backgroundY);
    await scrollCheckout(page, dialog, width, -2000);
    await expect(dialog.getByRole('button', { name: 'Cerrar modal' })).toBeInViewport();
    await dialog.getByRole('button', { name: 'Cerrar modal' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('html')).not.toHaveCSS('overflow-y', 'hidden');
    await expect(page.locator('body')).not.toHaveCSS('overflow-y', 'hidden');
  });
}

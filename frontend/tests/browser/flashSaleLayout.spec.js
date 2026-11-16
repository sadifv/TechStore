import { test, expect } from './fixtures.js';

for (const theme of ['normal', 'halloween', 'christmas']) {
  test(`oferta activa sin desbordamiento y con enlace al producto: ${theme}`, async ({
    page,
    mock,
  }, testInfo) => {
    mock.theme = theme;
    mock.handlers.set('GET /api/products/home', (route) =>
      route.fulfill({
        json: {
          success: true,
          products: [mock.product],
          categoryImages: [],
          flashSale: {
            ...mock.product,
            originalPrice: 329,
            price: 263.2,
            flashSale: true,
            flashSaleDiscount: 20,
            flashSaleEndsAt: new Date(Date.now() + 86400000).toISOString(),
          },
        },
      }),
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const offer = page.locator('.flash-sale-card');
    await expect(offer).toBeVisible();
    await expect(page.locator('.logo-intro')).toBeHidden();
    for (const width of [320, 390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 950 });
      await offer.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${theme}, ${width}px`,
      ).toBeLessThanOrEqual(width);
      await expect(offer.getByRole('link', { name: 'Comprar Ahora' })).toHaveAttribute(
        'href',
        `/producto/${mock.product._id}`,
      );
      await expect(offer.locator('.flash-sale-prices strong')).toHaveText('$263,20');
      await expect(offer.locator('.countdown-block')).toHaveCount(4);
      if (width === 390 || width === 1920) {
        await offer.screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`) });
      }
    }
  });
}

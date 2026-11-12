import { test, expect } from './fixtures.js';

test('el scroll despliega el producto y se acerca a su interior sin bloquear la página', async ({
  page,
  mock,
}, testInfo) => {
  mock.role = 'guest';
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const hero = page.locator('#inicio');
  await expect(hero).toHaveAttribute('data-scroll', 'true');
  await expect(page.locator('.cinema-assembled')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('.cinema-assembled').evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('cinema-intro.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Ver escena 2' }).click();
  await expect(hero).toHaveAttribute('data-chapter', '1');
  await page.screenshot({ path: testInfo.outputPath('cinema-exploded.png') });
  await page.getByRole('button', { name: 'Ver escena 3' }).click();
  await expect(hero).toHaveAttribute('data-chapter', '2');
  await page.screenshot({ path: testInfo.outputPath('cinema-detail.png') });
  const bounds = await page.locator('.cinema-stage').boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(74);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(901);
  await page.mouse.wheel(0, 600);
  await expect(page.getByRole('heading', { name: 'Productos destacados' })).toBeInViewport();
  expect(errors).toEqual([]);
  expect(mock.requests.filter(({ key }) => !key.startsWith('GET '))).toEqual([]);
});

for (const theme of ['normal', 'halloween', 'christmas']) {
  test(`escena completa y controles accesibles en ${theme}`, async ({ page, mock }, testInfo) => {
    mock.theme = theme;
    for (const width of [390, 320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.locator('.cinema-assembled')).toBeVisible();
      await expect(
        page.locator('.cinema-actions').getByRole('link', { name: 'Ver catálogo', exact: true }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: testInfo.outputPath(`${theme}-${width}.png`),
          animations: 'disabled',
        });
    }
  });
}

test('movimiento reducido permite explorar escenas sin recorrido fijado', async ({
  page,
  mock,
}) => {
  mock.role = 'guest';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('#inicio')).toHaveAttribute('data-scroll', 'false');
  await page.getByRole('button', { name: 'Ver escena 2' }).click();
  await expect(page.locator('#inicio')).toHaveAttribute('data-chapter', '1');
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page
    .locator('.cinema-actions')
    .getByRole('link', { name: 'Ver catálogo', exact: true })
    .click();
  await expect(page).toHaveURL('/catalogo');
});

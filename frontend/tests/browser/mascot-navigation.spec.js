import { test, expect } from './fixtures.js';

for (const theme of ['normal', 'halloween', 'christmas']) {
for (const width of [320, 390, 768, 1024, 1440]) {
  test(`TechBot acompaña la navegación ${theme} a ${width}px`, async ({ page, mock }) => {
    mock.theme = theme;
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.logo-intro')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Saludar a TechBot' })).toHaveCount(1);
    await page.locator('.hero-cinema').evaluate(el => window.scrollTo(0, el.offsetTop + el.offsetHeight + 20));
    const robot = page.locator('#navbar-assistant .hero-mascot-button');
    await expect(robot).toBeVisible();
    const box = await robot.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeLessThan(150);
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width);
    await robot.click();
    await expect(page.getByRole('link', { name: 'Conocer TechBot' })).toBeVisible();
    const greeting = await page.locator('#hero-mascot-greeting').boundingBox();
    expect(greeting.x).toBeGreaterThanOrEqual(0);
    expect(greeting.x + greeting.width).toBeLessThanOrEqual(width);
    await robot.press('Escape');
    await expect(page.getByRole('link', { name: 'Conocer TechBot' })).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('.cinema-assistant .hero-mascot-button')).toBeVisible();
    await expect(page.locator('.cinema-assistant .hero-mascot-button')).toBeFocused();
    await expect(page.locator('#navbar-assistant .hero-mascot')).toHaveCount(0);
  });
}
}

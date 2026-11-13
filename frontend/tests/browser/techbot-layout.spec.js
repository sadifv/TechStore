import { test, expect, product } from './fixtures.js';

for (const theme of ['normal', 'halloween', 'christmas']) {
  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`TechBot mantiene un solo panel en ${theme} a ${width}px`, async ({ page, mock }, testInfo) => {
      mock.role = 'user';
      mock.theme = theme;
      mock.handlers.set('GET /api/ai/history', (route) => route.fulfill({ json: { success: true, history: [] } }));
      mock.handlers.set('POST /api/ai/recommendations', (route) => route.fulfill({ json: {
        success: true, products: [0, 1, 2].map((index) => ({ ...product,
          _id: `${index}aaaaaaaaaaaaaaaaaaaaaaa`, name: `Monitor de prueba ${index + 1}`,
          reasons: ['Dentro de tu presupuesto máximo.', 'Panel: IPS', 'Confirma los requisitos de tus dispositivos.'],
        })),
      } }));
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#ai-assistant');
      const panel = page.locator('.ai-console');
      await expect(panel).toBeVisible();
      await expect(page.locator('.logo-intro')).toBeHidden();
      async function checkBounds(selectors) {
        const box = await panel.boundingBox();
        for (const selector of selectors) {
          const child = await page.locator(selector).boundingBox();
          expect(child.x).toBeGreaterThanOrEqual(box.x);
          expect(child.x + child.width).toBeLessThanOrEqual(box.x + box.width + 1);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await checkBounds(['.ai-header', '.guided-shopping-modes', '.ai-widget', '.ai-fieldset']);
      const header = await page.locator('.ai-header').boundingBox();
      const chat = await page.locator('.ai-widget').boundingBox();
      expect(Math.abs(header.width - chat.width)).toBeLessThan(2);
      await page.locator('#ai-chat-input').fill('Mi consulta queda aquí');
      if ([390, 1440].includes(width)) {
        await page.locator('#ai-assistant').evaluate((element) => element.scrollIntoView());
        await page.screenshot({ path: testInfo.outputPath('chat.png') });
      }
      await page.getByRole('button', { name: 'Compra guiada', exact: true }).click();
      await page.getByRole('button', { name: 'Buscar opciones', exact: true }).click();
      await expect(page.locator('.guided-shopping-products > li')).toHaveCount(3);
      await checkBounds(['.guided-shopping', '.guided-shopping-form', '.guided-shopping-products']);
      await expect(page.locator('.guided-shopping-products .product-card').first().getByRole('heading', { name: 'Por qué aparece' })).toBeVisible();
      if ([390, 1440].includes(width)) {
        await page.locator('#ai-assistant').evaluate((element) => element.scrollIntoView());
        await page.screenshot({ path: testInfo.outputPath('guided.png') });
      }
      await page.getByRole('button', { name: 'Chat libre', exact: true }).click();
      await expect(page.locator('#ai-chat-input')).toHaveValue('Mi consulta queda aquí');
    });
  }
}

import { test, expect, product } from './fixtures.js';

test('compra guiada consulta preferencias y reutiliza comparación y carrito', async ({
  page,
  mock,
}, testInfo) => {
  mock.role = 'user';
  mock.handlers.set('GET /api/ai/history', (route) =>
    route.fulfill({ json: { success: true, history: [] } }),
  );
  let added = false;
  mock.handlers.set('POST /api/cart/add', (route) => {
    added = true;
    return route.fulfill({ json: { success: true } });
  });
  mock.handlers.set('GET /api/cart', (route) =>
    route.fulfill({
      json: {
        success: true,
        items: added ? [{ _id: 'fixture-cart', product, quantity: 1 }] : [],
      },
    }),
  );
  mock.handlers.set('POST /api/ai/recommendations', (route) =>
    route.fulfill({
      json: {
        success: true,
        products: [
          {
            ...product,
            reasons: [
              'Dentro de tu presupuesto máximo.',
              'Faltan especificaciones para valorar el uso elegido.',
            ],
          },
        ],
      },
    }),
  );
  await page.goto('/#ai-assistant');
  await page.getByRole('button', { name: 'Compra guiada', exact: true }).click();
  await page.getByLabel('¿Qué buscas?', { exact: true }).selectOption('Laptops');
  await page.getByLabel('Presupuesto máximo en USD (opcional)').fill('400');
  await page.getByRole('button', { name: 'Buscar opciones', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Resultados de compra guiada' })).toBeVisible();
  const request = mock.requests.find((item) => item.key === 'POST /api/ai/recommendations');
  expect(JSON.parse(request.body)).toEqual({ category: 'Laptops', use: 'estudiar', budget: 400 });
  const results = page.getByRole('region', { name: 'Resultados de compra guiada' });
  await results.getByRole('checkbox', { name: /Comparar/ }).check();
  await expect(results.getByRole('heading', { name: 'Comparar productos' })).toBeVisible();
  await page
    .locator('.guided-shopping')
    .screenshot({ path: testInfo.outputPath('guided-desktop.png') });
  await results.getByRole('button', { name: 'Agregar al Carrito', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ver carrito, 1 productos' })).toBeVisible();
  await page.getByRole('button', { name: 'Chat libre', exact: true }).click();
  await expect(page.locator('#ai-chat-input')).toBeVisible();
});

for (const theme of ['normal', 'halloween', 'christmas']) {
  test(`guía informa vacío y errores, permite editar y se adapta a móvil en ${theme}`, async ({
    page,
    mock,
  }, testInfo) => {
    mock.role = 'user';
    mock.theme = theme;
    mock.handlers.set('GET /api/ai/history', (route) =>
      route.fulfill({ json: { success: true, history: [] } }),
    );
    await page.setViewportSize({ width: 320, height: 800 });
    let calls = 0;
    mock.handlers.set('POST /api/ai/recommendations', (route) => {
      calls += 1;
      return route.fulfill(
        calls === 1
          ? { status: 429, json: { success: false, error: 'Espera y vuelve a intentarlo.' } }
          : { json: { success: true, products: [] } },
      );
    });
    await page.goto('/#ai-assistant');
    await page.getByRole('button', { name: 'Compra guiada', exact: true }).click();
    await page.getByRole('button', { name: 'Buscar opciones', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Espera y vuelve a intentarlo.');
    await page.getByRole('button', { name: 'Buscar opciones', exact: true }).click();
    await expect(page.getByText(/No hay opciones disponibles dentro/)).toBeVisible();
    await page.getByLabel('¿Qué buscas?', { exact: true }).selectOption('Audio');
    await expect(page.getByText(/No hay opciones disponibles dentro/)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('.guided-shopping')
      .screenshot({ path: testInfo.outputPath(`guided-${theme}-mobile.png`) });
  });
}

test('visitantes conservan acceso con sesión y no consultan recomendaciones', async ({
  page,
  mock,
}) => {
  await page.goto('/#ai-assistant');
  await expect(page.getByRole('button', { name: 'Compra guiada', exact: true })).toHaveCount(0);
  expect(mock.requests.some((item) => item.key.includes('recommendations'))).toBe(false);
});

test('cambiar respuestas descarta una recomendación que llega tarde', async ({ page, mock }) => {
  mock.role = 'user';
  mock.handlers.set('GET /api/ai/history', (route) =>
    route.fulfill({ json: { success: true, history: [] } }),
  );
  let release;
  mock.handlers.set(
    'POST /api/ai/recommendations',
    (route) =>
      new Promise((resolve) => {
        release = async () => {
          try {
            await route.fulfill({
              json: { success: true, products: [{ ...product, reasons: ['Resultado anterior'] }] },
            });
          } catch {
            /* La solicitud cancelada puede haber cerrado su ruta. */
          }
          resolve();
        };
      }),
  );
  await page.goto('/#ai-assistant');
  await page.getByRole('button', { name: 'Compra guiada', exact: true }).click();
  await page.getByRole('button', { name: 'Buscar opciones', exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.getByLabel('Presupuesto máximo en USD (opcional)').fill('20');
  await release();
  await expect(page.getByRole('region', { name: 'Resultados de compra guiada' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Buscar opciones', exact: true })).toBeEnabled();
});

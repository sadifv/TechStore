import { test, expect, product } from './fixtures.js';

test('datos iguales no certifican equivalencia técnica', async ({ page, mock }) => {
  mock.handlers.set('GET /api/products', (route) =>
    route.fulfill({
      json: {
        success: true,
        products: [
          { ...product, specifications: [] },
          { ...product, _id: 'dddddddddddddddddddddddd', name: 'Otra opción', specifications: [] },
        ],
        pagination: { currentPage: 1, totalPages: 1 },
      },
    }),
  );
  await page.goto('/catalogo');
  await page.locator('.product-card input[type="checkbox"]').nth(0).check();
  await page.locator('.product-card input[type="checkbox"]').nth(1).check();
  await page.getByRole('checkbox', { name: 'Mostrar solo diferencias' }).check();
  await expect(page.getByText(/No hay diferencias en los datos publicados/)).toBeVisible();
  await expect(page.getByText(/Los campos faltantes no permiten confirmar/)).toBeVisible();
  await page.getByRole('checkbox', { name: 'Mostrar solo diferencias' }).uncheck();
  await expect(
    page
      .getByRole('region', { name: 'Tabla de comparación' })
      .getByRole('rowheader', { name: 'Precio', exact: true }),
  ).toBeVisible();
});

const names = [
  'Procesador AMD Ryzen 5 5600',
  'Placa madre B550 micro ATX',
  'Kit RAM DDR4 16 GB',
  'Procesador AMD Ryzen 5 7600',
  'Placa madre B650 micro ATX',
  'Kit RAM DDR5 16 GB',
  "Monitor LG UltraGear 27'' 144Hz",
  'Teclado Mecánico Keychron K2',
  'Mouse Logitech MX Master 3S',
];
const kitProducts = names.map((name, index) => ({
  ...product,
  _id: `${index}aaaaaaaaaaaaaaaaaaaaaaa`,
  name,
  price: 100 + index,
  category: 'Componentes',
}));

for (const theme of ['normal', 'halloween', 'christmas']) {
  test(`pasos, vista y reinicio del configurador en ${theme}`, async ({ page, mock }, testInfo) => {
    mock.theme = theme;
    mock.handlers.set('GET /api/products', (route) =>
      route.fulfill({
        json: {
          success: true,
          products: kitProducts,
          pagination: { currentPage: 1, totalPages: 1 },
        },
      }),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/arma-tu-equipo');
    const progress = page.getByRole('navigation', { name: 'Progreso de la selección' });
    await expect(progress.getByRole('button', { name: /^Placa madre/ })).toBeDisabled();
    await page.getByLabel('Procesador', { exact: true }).selectOption(names[0]);
    await expect(page.locator('.build-kit-preview [data-filled="true"]')).toHaveCount(1);
    await progress.getByRole('button', { name: /^Placa madre/ }).click();
    await expect(page.getByLabel('Placa madre', { exact: true })).toBeFocused();
    await page.getByLabel('Placa madre', { exact: true }).selectOption(names[1]);
    await page.getByLabel('Memoria RAM', { exact: true }).selectOption(names[2]);
    await expect(progress.getByRole('button', { name: /^Resumen/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(page.getByRole('button', { name: 'Añadir selección al carrito' })).toBeDisabled();
    await page.getByLabel('Memoria RAM', { exact: true }).selectOption('');
    await expect(progress.getByRole('button', { name: /^Memoria RAM/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(progress.getByRole('button', { name: /^Resumen/ })).not.toHaveAttribute(
      'aria-current',
      'step',
    );
    await page.getByLabel('Procesador', { exact: true }).selectOption('');
    await expect(progress.getByRole('button', { name: /^Procesador/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(progress.getByRole('button', { name: /^Placa madre/ })).toBeDisabled();
    await expect(page.locator('.build-kit-preview [data-filled="true"]')).toHaveCount(0);
    await page.getByLabel('Plataforma', { exact: true }).selectOption('AM5');
    await expect(page.locator('.build-kit-preview [data-filled="true"]')).toHaveCount(0);
    await expect(page.getByLabel('Placa madre', { exact: true })).toBeDisabled();
    await page.getByRole('radio', { name: 'Escritorio', exact: true }).check();
    await page.getByRole('checkbox', { name: /Teclado Mecánico Keychron K2/ }).check();
    await expect(page.locator('.build-kit-preview [data-filled="true"]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.build-kit-preview img')).toHaveCSS('animation-name', 'none');
    await page.getByRole('button', { name: 'Añadir selección al carrito' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Selección añadida al carrito.' }),
    ).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('checkbox', { name: /Mouse Logitech/ }).check();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('.logo-intro')).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath('builder.png'), fullPage: true });
  });

  test(`comparador interactivo filtra diferencias y destaca columnas en ${theme}`, async ({
    page,
    mock,
  }, testInfo) => {
    mock.theme = theme;
    mock.handlers.set('GET /api/products', (route) =>
      route.fulfill({
        json: {
          success: true,
          products: [
            product,
            {
              ...product,
              _id: 'dddddddddddddddddddddddd',
              name: 'Monitor alternativo',
              price: 400,
              specifications: [
                { name: 'Panel', value: 'IPS' },
                { name: 'Resolución', value: '4K' },
              ],
            },
          ],
          pagination: { currentPage: 1, totalPages: 1 },
        },
      }),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/catalogo');
    await page.locator('.product-card input[type="checkbox"]').nth(0).check();
    await page.locator('.product-card input[type="checkbox"]').nth(1).check();
    const table = page.getByRole('region', { name: 'Tabla de comparación' });
    await expect(table.getByRole('rowheader', { name: 'Panel', exact: true })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Mostrar solo diferencias' }).check();
    await expect(table.getByRole('rowheader', { name: 'Panel', exact: true })).toHaveCount(0);
    await expect(table.getByRole('rowheader', { name: 'Resolución', exact: true })).toBeVisible();
    await table.getByRole('button', { name: 'Destacar columna' }).first().click();
    await expect(table.getByRole('button', { name: 'Columna destacada' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(table.locator('thead th[data-highlighted="true"]')).toHaveCount(1);
    await page.getByRole('checkbox', { name: 'Mostrar solo diferencias' }).uncheck();
    await expect(table.getByRole('rowheader', { name: 'Panel', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator('.logo-intro')).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('comparison.png'), fullPage: true });
    await page.getByRole('button', { name: 'Limpiar selección', exact: true }).click();
    await expect(table).toHaveCount(0);
  });
}

test('luz decorativa al pasar el puntero se desactiva con movimiento reducido', async ({
  page,
  mock,
}) => {
  mock.product.price = 200;
  await page.goto('/catalogo');
  const card = page.locator('.product-card').first();
  await expect(card).toBeVisible();
  await card.hover();
  await expect
    .poll(() =>
      card
        .locator('.product-card-media')
        .evaluate((element) => getComputedStyle(element, '::after').opacity),
    )
    .toBe('1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() =>
      card
        .locator('.product-card-media')
        .evaluate((element) => getComputedStyle(element, '::after').opacity),
    )
    .toBe('0');
});

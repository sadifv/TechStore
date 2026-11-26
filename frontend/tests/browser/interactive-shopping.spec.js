import { test, expect, product } from './fixtures.js';
import { checkContrast } from './contrast.js';

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
  await checkContrast(page, ['.comparison-price', '.comparison-stock[data-available="true"]']);
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

test('recupera la selección compartida con un reemplazo para la pieza retirada', async ({ page, mock }) => {
  const replacement = 'Procesador AMD Ryzen 7 5700X';
  mock.handlers.set('GET /api/products', (route) =>
    route.fulfill({ json: { success: true, products: [
      ...kitProducts.slice(1).map((item) =>
        item.name === names[2] ? { ...item, availableStock: 0 } : item),
      { ...product, _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: replacement },
      { ...product, _id: 'cccccccccccccccccccccccc', name: 'Kit RAM DDR4 32 GB' },
      { ...product, _id: 'dddddddddddddddddddddddd', name: 'SSD vigente', category: 'Componentes',
        specifications: [{ name: 'Tipo de pieza', value: 'Almacenamiento' }] },
    ] } }),
  );
  const params = new URLSearchParams({ kit: 'pc', platform: 'AM4' });
  for (const name of names.slice(0, 3)) params.append('part', name);
  params.append('part', 'SSD retirado');
  for (const previous of ['', '90.00', '', '']) params.append('partPrice', previous);
  for (const slot of ['', '', '', 'SSD']) params.append('partSlot', slot);
  await page.goto(`/arma-tu-equipo?${params}`);
  await expect(page.getByText(`${names[0]} · Fuera del catálogo`, { exact: true })).toBeVisible();
  await expect(page.getByText(/Precio indicado en el enlace/)).toBeVisible();
  await expect(page.getByRole('button', { name: `Elegir reemplazo para ${names[2]}` })).toBeVisible();
  await page.getByRole('button', { name: `Elegir reemplazo para ${names[0]}` }).click();
  const processor = page.getByLabel('Procesador', { exact: true });
  await expect(processor).toBeFocused();
  await processor.selectOption(replacement);
  await expect(page.getByLabel('Placa madre', { exact: true })).toHaveValue(names[1]);
  await expect(page.getByLabel('Memoria RAM', { exact: true })).toHaveValue(names[2]);
  await expect(page.getByText(`${names[0]} · Fuera del catálogo`, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Elegir reemplazo para SSD retirado' }).click();
  await expect(page.getByLabel('SSD', { exact: true })).toBeFocused();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Compartir armado' }).click();
  await expect(page.getByText('Enlace de la selección copiado.')).toBeVisible();
  const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  expect(copied.searchParams.getAll('part')).toContain('SSD retirado');
  expect(copied.searchParams.getAll('partSlot').at(-1)).toBe('SSD');
});

test('muestra piezas adicionales y avisa si la fuente queda corta para la gráfica', async ({
  page,
  mock,
}) => {
  const extra = [
    { name: 'SSD de prueba', specifications: [{ name: 'Tipo de pieza', value: 'Almacenamiento' }] },
    {
      name: 'Fuente de prueba',
      specifications: [
        { name: 'Tipo de pieza', value: 'Fuente de alimentación' },
        { name: 'Potencia (W)', value: '400' },
      ],
    },
    {
      name: 'Gráfica de prueba',
      specifications: [
        { name: 'Tipo de pieza', value: 'Tarjeta gráfica' },
        { name: 'Fuente recomendada (W)', value: '650' },
      ],
    },
  ].map((item, index) => ({
    ...product,
    ...item,
    category: 'Componentes',
    _id: String(index + 10).padStart(24, '0'),
  }));
  mock.handlers.set('GET /api/products', (route) =>
    route.fulfill({ json: { success: true, products: [...kitProducts, ...extra] } }),
  );
  await page.goto('/arma-tu-equipo');
  await page.getByLabel('Procesador', { exact: true }).selectOption(names[0]);
  await page.getByLabel('Placa madre', { exact: true }).selectOption(names[1]);
  await page.getByLabel('Memoria RAM', { exact: true }).selectOption(names[2]);
  await page.getByLabel('Fuente', { exact: true }).selectOption(extra[1].name);
  await page.getByLabel('Gráfica', { exact: true }).selectOption(extra[2].name);
  await expect(
    page.getByText('La fuente queda por debajo de la potencia recomendada para la gráfica.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Añadir selección al carrito' })).toHaveCount(0);
});

test('recomienda únicamente complementos con stock y permite añadirlos', async ({ page, mock }) => {
  const keyboard = { ...kitProducts[7], name: 'Teclado Keychron renovado' };
  const mouse = { ...kitProducts[8], availableStock: 0 };
  mock.product.complements = [
    { productId: keyboard._id, name: names[7], reason: 'Escribe sin usar el teclado integrado.' },
    { productId: mouse._id, name: names[8] },
  ];
  for (const item of [keyboard, mouse]) {
    mock.handlers.set(`GET /api/products/${item._id}`, (route) =>
      route.fulfill({ json: { success: true, data: item } }),
    );
  }
  await page.goto(`/producto/${mock.product._id}`);
  const complements = page.getByRole('region', { name: 'Complementos disponibles' });
  await expect(complements.getByRole('checkbox', { name: /Keychron/ })).toBeVisible();
  await expect(complements.getByText('Escribe sin usar el teclado integrado.')).toBeVisible();
  await expect(complements.getByRole('checkbox', { name: /Logitech/ })).toHaveCount(0);
  await complements.getByRole('checkbox', { name: /Keychron/ }).check();
  await complements.getByRole('button', { name: 'Añadir complementos seleccionados' }).click();
  await expect(complements).toHaveCount(0);
});

test('el carrito de invitado consulta complementos de productos añadidos antes de configurarlos', async ({
  page,
  mock,
}) => {
  const keyboard = kitProducts[7];
  mock.product.complements = [{ productId: keyboard._id, name: keyboard.name }];
  mock.handlers.set(`GET /api/products/${keyboard._id}`, (route) =>
    route.fulfill({ json: { success: true, data: keyboard } }),
  );
  await page.addInitScript(
    (item) => {
      localStorage.setItem('techstore_guest_cart', JSON.stringify([item]));
    },
    { id: mock.product._id, name: mock.product.name, price: mock.product.price, quantity: 1 },
  );
  await page.goto('/catalogo');
  await page.locator('#cart-btn').click();
  await expect(
    page.getByRole('dialog', { name: 'Tu Carrito' }).getByRole('checkbox', { name: /Keychron/ }),
  ).toBeVisible();
});

test('guarda una selección y la vuelve a abrir desde Mi cuenta', async ({ page, mock }) => {
  mock.role = 'user';
  let selection;
  mock.handlers.set('GET /api/products', (route) =>
    route.fulfill({ json: { success: true, products: kitProducts } }),
  );
  mock.handlers.set('PUT /api/saved-build', (route) => {
    ({ selection } = route.request().postDataJSON());
    return route.fulfill({ json: { success: true } });
  });
  mock.handlers.set('GET /api/saved-build', (route) =>
    route.fulfill({ json: { success: true, builds: [
      { id: '1', selection, changes: [{ name: names[0], previousPrice: 100, currentPrice: 120, available: false }] },
      { id: '2', selection: new URLSearchParams({ kit: 'pc', platform: 'AM5', part: names[3] }).toString(), changes: [] },
    ] } }),
  );
  mock.handlers.set('GET /api/orders', (route) =>
    route.fulfill({ json: { success: true, orders: [] } }),
  );
  mock.handlers.set('GET /api/addresses', (route) =>
    route.fulfill({ json: { success: true, data: { addresses: [], defaultAddressId: null } } }),
  );

  await page.goto('/arma-tu-equipo');
  await page.getByLabel('Procesador', { exact: true }).selectOption(names[0]);
  await page.getByRole('button', { name: 'Guardar armado', exact: true }).click();
  await expect(page.getByText('Selección guardada en Mi cuenta.')).toBeVisible();
  await page.goto('/profile');
  const builds = page.getByRole('region', { name: 'Mis armados' });
  await expect(builds.getByRole('link', { name: 'Retomar armado' })).toHaveCount(2);
  await expect(builds.getByText(/Precio:.*100.*120.*Agotado/)).toBeVisible();
  await builds.getByRole('link', { name: 'Retomar armado' }).first().click();
  await expect(page.getByLabel('Procesador', { exact: true })).toHaveValue(names[0]);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Compartir armado' }).click();
  await expect(page.getByText('Enlace de la selección copiado.')).toBeVisible();
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  mock.role = 'guest';
  await page.goto(shared);
  await expect(page.getByLabel('Procesador', { exact: true })).toHaveValue(names[0]);
});

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
    await expect(page.getByRole('button', { name: 'Añadir selección al carrito' })).toHaveCount(0);
    await expect(page.getByText(/^Subtotal estimado/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compartir armado' })).toBeVisible();
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

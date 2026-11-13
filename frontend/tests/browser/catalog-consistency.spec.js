import { test, expect, product } from './fixtures.js';

test('reintenta sin perder filtros y los limpia sin perder parámetros ajenos', async ({ page, mock }) => {
  let attempts = 0;
  mock.handlers.set('GET /api/products', (route) => {
    attempts += 1;
    return route.fulfill(attempts === 1
      ? { status: 502, json: { error: 'Fallo temporal de prueba' } }
      : { json: { success: true, products: [product], pagination: { currentPage: 1, totalPages: 1 } } });
  });
  await page.goto('/catalogo?category=Monitores&sort=price_desc&search=monitor&utm_source=prueba');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.getByLabel('Categoría:', { exact: true })).toHaveValue('Monitores');
  await expect(page.getByRole('searchbox')).toHaveValue('monitor');
  expect(attempts).toBe(2);
  await page.getByRole('searchbox').fill('borrador pendiente');
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await expect(page).toHaveURL(/\/catalogo\?utm_source=prueba$/);
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.getByLabel('Ordenar por:', { exact: true })).toHaveValue('recent');
  await expect(page.getByRole('button', { name: 'Limpiar filtros', exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByLabel('Categoría:', { exact: true })).toHaveValue('Monitores');
});

test('los filtros se comparten por URL y respetan recarga, atrás y adelante', async ({ page, mock }) => {
  mock.handlers.set('GET /api/products', (route) => {
    const query = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: { success: true, products: [product], pagination: {
      currentPage: Number(query.get('page') || 1), totalPages: 3, totalCount: 17,
    } } });
  });
  await page.goto('/catalogo?utm_source=prueba');
  const initialHistoryLength = await page.evaluate(() => history.length);
  await page.getByLabel('Categoría:', { exact: true }).selectOption('Monitores');
  await expect(page).toHaveURL(/category=Monitores/);
  await page.getByLabel('Ordenar por:', { exact: true }).selectOption('price_desc');
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength + 2);
  await page.getByRole('searchbox', { name: 'Buscar productos' }).fill('Pantalla');
  await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe('Pantalla');
  await page.getByRole('searchbox', { name: 'Buscar productos' }).fill('Pantalla & audio');
  await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe('Pantalla & audio');
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength + 2);
  await page.getByRole('navigation', { name: 'Navegación de páginas' }).getByRole('button', { name: '2', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength + 3);
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Buscar productos' })).toHaveValue('Pantalla & audio');
  await expect(page.getByLabel('Categoría:', { exact: true })).toHaveValue('Monitores');
  await expect(page.getByLabel('Ordenar por:', { exact: true })).toHaveValue('price_desc');
  await page.goBack();
  await expect(page.locator('#pagination-controls button[aria-current="page"]')).toHaveText('1');
  await page.goBack();
  await expect(page.getByRole('searchbox', { name: 'Buscar productos' })).toHaveValue('');
  await expect(page.getByLabel('Ordenar por:', { exact: true })).toHaveValue('recent');
  await page.goForward();
  await expect(page.getByRole('searchbox', { name: 'Buscar productos' })).toHaveValue('Pantalla & audio');
  expect(new URL(page.url()).searchParams.get('utm_source')).toBe('prueba');
});

test('tarjeta, ficha y carrito comparten USD y reservan dimensiones para sus imágenes', async ({ page, mock }) => {
  mock.product.price = 1234.56;
  await page.goto('/catalogo');
  const expected = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(1234.56);
  await expect(page.locator('.product-card .product-price').first()).toHaveText(expected);
  await expect(page.locator('.product-card img').first()).toHaveAttribute('width', /\d+/);
  await page.locator(`a[href="/producto/${product._id}"]`).first().click();
  await expect(page.locator('.product-detail-price')).toHaveText(expected);
  await expect(page.locator('.product-detail-media img')).toHaveAttribute('height', /\d+/);
  await page.getByRole('button', { name: 'Añadir al carrito', exact: true }).click();
  await page.getByRole('button', { name: 'Ver carrito, 1 productos' }).click();
  await expect(page.locator('#cart-total')).toHaveText(expected);
  await expect(page.locator('.cart-item img')).toHaveAttribute('width', /\d+/);
  await page.getByRole('button', { name: 'Continuar con el pedido', exact: true }).click();
  await expect(page.getByText('Coordinación del pedido', { exact: true })).toBeVisible();
  await expect(page.getByText('Costo de entrega no incluido; se coordina por WhatsApp.', { exact: true })).toBeVisible();
  await expect(page.locator('.checkout-summary-box strong')).toHaveText(expected);
});

for (const [path, selector] of [
  ['/catalogo', '.product-card img'],
  [`/producto/${product._id}`, '.product-detail-media img'],
]) {
  test(`la imagen reserva espacio antes de cargarse en ${path}`, async ({ page, mock }) => {
    mock.product.image = '/images/products/catalog-fallback.jpg';
    let release;
    const ready = new Promise((resolve) => { release = resolve; });
    await page.route('**/images/products/catalog-fallback.jpg', async (route) => {
      await ready;
      await route.continue();
    });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const picture = page.locator(selector).first();
    await expect(picture).toBeVisible();
    expect(await picture.evaluate((element) => element.naturalWidth)).toBe(0);
    const before = await picture.boundingBox();
    release();
    await expect.poll(() => picture.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
    const after = await picture.boundingBox();
    expect(Math.abs(after.height - before.height)).toBeLessThan(1);
    expect(Math.abs(after.width - before.width)).toBeLessThan(1);
  });
}

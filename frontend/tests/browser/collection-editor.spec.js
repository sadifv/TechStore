import { test, expect } from './fixtures.js';

test('el administrador crea, renombra y elimina una colección sin eliminar productos', async ({
  page,
  mock,
}) => {
  mock.role = 'admin';
  let definitions = [
    { key: 'setup', title: 'Arma tu setup', theme: 'all', order: 0, enabled: true },
  ];
  const groups = {};
  mock.handlers.set('GET /api/admin/collections', (route) =>
    route.fulfill({ json: { success: true, definitions, collections: groups } }),
  );
  mock.handlers.set('PATCH /api/admin/collections/definition', async (route) => {
    const body = route.request().postDataJSON();
    definitions = definitions.filter(({ key }) => key !== body.key);
    if (!body.remove) definitions.push(body);
    else delete groups[body.key];
    await route.fulfill({ json: { success: true } });
  });
  mock.handlers.set('PATCH /api/admin/collections', async (route) => {
    const { key, ids } = route.request().postDataJSON();
    groups[key] = ids;
    await route.fulfill({ json: { success: true } });
  });
  mock.handlers.set('GET /api/admin/products', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          products: [mock.product],
          pagination: { currentPage: 1, totalPages: 1, totalProducts: 1 },
        },
      },
    }),
  );
  await page.goto('/admin/dashboard');
  await page.getByText('Editar colecciones de la portada', { exact: true }).click();
  const editor = page.locator('.collections-editor');
  await editor.locator('.collection-select select').selectOption('');
  await editor.getByLabel('Identificador', { exact: true }).fill('audio-regalos');
  await editor.getByLabel('Nombre de la colección').fill('Regalos de audio');
  await editor.getByRole('button', { name: 'Crear colección', exact: true }).click();
  await expect(editor.getByText('Datos de la colección guardados.')).toBeVisible();
  await expect(editor.locator('.collection-select select')).toHaveValue('audio-regalos');
  await editor.getByRole('checkbox', { name: mock.product.name }).check();
  // Saving a title must not discard the selection that has not been saved yet.
  await editor.getByLabel('Nombre de la colección').fill('Audio con selección pendiente');
  await editor.getByRole('button', { name: 'Guardar datos', exact: true }).click();
  await expect(editor.locator('.collection-select select')).toContainText(
    'Audio con selección pendiente',
  );
  await expect(editor.getByRole('checkbox', { name: mock.product.name })).toBeChecked();
  expect(groups['audio-regalos']).toBeUndefined();
  await editor.getByRole('button', { name: 'Guardar colección', exact: true }).click();
  await expect(editor.getByText('Colección guardada.', { exact: true })).toBeVisible();
  expect(groups['audio-regalos']).toEqual([mock.product._id]);
  await editor.getByLabel('Nombre de la colección').fill('Audio para regalar');
  await editor.getByRole('button', { name: 'Guardar datos', exact: true }).click();
  await expect(editor.locator('.collection-select select')).toContainText('Audio para regalar');
  await editor.getByRole('button', { name: 'Eliminar colección', exact: true }).click();
  await editor.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click();
  await expect(editor.getByText('Colección eliminada. Los productos se conservan.')).toBeVisible();
  expect(definitions.some(({ key }) => key === 'audio-regalos')).toBe(false);
  expect(mock.requests.some(({ key }) => key.startsWith('DELETE /api/admin/products/'))).toBe(
    false,
  );
});

test('la portada muestra títulos de colecciones personalizados publicados por el servidor', async ({
  page,
  mock,
}) => {
  mock.handlers.set('GET /api/store/collections', (route) =>
    route.fulfill({
      json: {
        success: true,
        definitions: [{ key: 'mi-coleccion', title: 'Audio para regalar' }],
        collections: { 'mi-coleccion': [mock.product] },
      },
    }),
  );
  await page.goto('/');
  await page.locator('.home-collections-slot').scrollIntoViewIfNeeded();
  await expect(
    page.locator('.home-collections').getByRole('heading', { name: 'Audio para regalar' }),
  ).toBeVisible();
  await expect(
    page
      .locator('.home-collections')
      .getByRole('link', { name: `Ver detalles de ${mock.product.name}` }),
  ).toBeVisible();
});

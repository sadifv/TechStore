import { test, expect, product } from './fixtures.js';

for (const theme of ['normal', 'halloween', 'christmas']) {
  test(`selectores del catálogo con teclado y tema ${theme}`, async ({ page, mock }, testInfo) => {
    mock.theme = theme;
    await page.goto('/catalogo');
    await expect(page.locator('.logo-intro')).toBeHidden();
    const category = page.getByLabel('Categoría:', { exact: true });
    await category.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(category).not.toHaveValue('');
    await category.selectOption('Audio');
    await expect(page).toHaveURL(/category=Audio/);
    await category.click();
    await page.screenshot({ path: testInfo.outputPath('select-desktop.png') });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const theme of ['normal', 'halloween', 'christmas']) {
  for (const width of [320, 1440]) {
    test(`confirmación accesible ${theme} ${width}`, async ({ page, mock }, testInfo) => {
      mock.role = 'owner';
      mock.theme = theme;
      await page.setViewportSize({ width, height: 900 });
      mock.product.name = '<img src=x onerror=alert(1)> Producto de prueba';
      let writes = 0;
      mock.handlers.set(`DELETE /api/admin/products/${product._id}`, (route) => {
        writes++;
        return route.fulfill({ status: 409, json: { error: 'No se pudo archivar. Reintenta.' } });
      });
      await page.goto('/admin/dashboard');
      await expect(page.locator('.logo-intro')).toBeHidden();
      const trigger = page.getByRole('button', { name: 'Archivar', exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Archivar producto', exact: true });
      const cancel = dialog.getByRole('button', { name: 'Cancelar', exact: true });
      await expect(cancel).toBeFocused();
      await expect(dialog.locator('img')).toHaveCount(0);
      await expect(dialog).toContainText(mock.product.name);
      expect(writes).toBe(0);
      await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('button', { name: 'Archivar', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(cancel).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      expect(writes).toBe(0);
      await trigger.click();
      await page.screenshot({ path: testInfo.outputPath('confirmation.png') });
      expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      await dialog.getByRole('button', { name: 'Archivar', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('No se pudo archivar');
      expect(writes).toBe(1);
      await expect(dialog).toBeHidden();
    });
  }
}

test('campaña confirma los datos del formulario y cancelar no envía', async ({ page, mock }) => {
  mock.role = 'owner';
  let payload;
  mock.handlers.set('GET /api/admin/marketing', (route) =>
    route.fulfill({ json: { success: true, data: { coupons: [], campaigns: [] } } }),
  );
  mock.handlers.set('POST /api/admin/campaigns', (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ json: { success: true, message: 'Campaña de prueba en cola.' } });
  });
  await page.goto('/admin/marketing');
  await page.getByLabel('Nombre interno', { exact: true }).fill('Prueba');
  await page.getByLabel('Asunto del correo', { exact: true }).fill('Asunto de prueba');
  await page.getByLabel('Mensaje', { exact: true }).fill('Mensaje de ejemplo.');
  const send = page.getByRole('button', { name: 'Enviar campaña', exact: true });
  await send.click();
  const dialog = page.getByRole('dialog', { name: 'Enviar campaña', exact: true });
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(payload).toBeUndefined();
  await send.click();
  await dialog.getByRole('button', { name: 'Enviar campaña', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Campaña de prueba en cola.');
  expect(payload).toMatchObject({
    name: 'Prueba',
    subject: 'Asunto de prueba',
    content: 'Mensaje de ejemplo.',
    audience: 'newsletter',
  });
});

test('error de oferta se queda dentro del formulario abierto', async ({ page, mock }) => {
  mock.role = 'owner';
  mock.handlers.set(`POST /api/admin/products/${product._id}/flash-sale`, (route) =>
    route.fulfill({ status: 409, json: { error: 'La oferta no está disponible.' } }),
  );
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Oferta', exact: true }).click();
  const dialog = page.locator('dialog[open]');
  await dialog.getByRole('button', { name: 'Activar oferta', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('La oferta no está disponible.');
  await expect(dialog).toBeVisible();
});

test('TechBot conserva la conversación al cancelar y la borra solo al confirmar', async ({
  page,
  mock,
}) => {
  mock.role = 'user';
  let writes = 0;
  mock.handlers.set('GET /api/ai/history', (route) =>
    route.fulfill({
      json: { success: true, history: [{ role: 'user', content: 'Consulta de prueba' }] },
    }),
  );
  mock.handlers.set('DELETE /api/ai/history', (route) => {
    writes++;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/#ai-assistant');
  const clear = page.getByRole('button', { name: 'Limpiar conversación', exact: true });
  await clear.click();
  const dialog = page.getByRole('dialog', { name: 'Borrar conversación', exact: true });
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(writes).toBe(0);
  await expect(page.locator('.ai-history')).toContainText('Consulta de prueba');
  await clear.click();
  await dialog.getByRole('button', { name: 'Borrar conversación', exact: true }).click();
  await expect(clear).toHaveCount(0);
  expect(writes).toBe(1);
  await expect(page.locator('#ai-chat-input')).toBeFocused();
});

import { test, expect } from './fixtures.js';

test('el recorrido presenta TechStore y solo avanza al elegir una escena', async ({ page, mock }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cómo comprar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Así compras en TechStore' });
  await page.clock.install();
  await page.clock.runFor(14000);
  await expect(dialog.getByRole('heading', { name: 'Conoce TechStore', exact: true })).toBeVisible();
  await expect(
    dialog.locator('.purchase-guide-explanation').getByText(/configurador/),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Paso 1. Elige un producto' }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Elige un producto', exact: true }),
  ).toBeVisible();
  expect(mock.requests.filter(({ key }) => !key.startsWith('GET '))).toEqual([]);
});

for (const [theme, width] of [
  ['normal', 1440],
  ['halloween', 390],
  ['christmas', 320],
]) {
  test(`guía visual ${theme} a ${width}px`, async ({ page, mock }, testInfo) => {
    mock.theme = theme;
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Cómo comprar', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Así compras en TechStore' });
    await expect(dialog.getByRole('button', { name: 'Iniciar recorrido', exact: true })).toBeVisible();
    if (width < 761) {
      const explanation = dialog.locator('.purchase-guide-explanation');
      const content = await explanation.boundingBox();
      const controls = await dialog.locator('.purchase-guide-controls').boundingBox();
      expect(content.y + content.height).toBeLessThanOrEqual(controls.y);
      const heading = explanation.getByRole('heading', { name: 'Conoce TechStore', exact: true });
      await expect(heading).toBeVisible();
      expect(await heading.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(bounds.x + 8, bounds.y + 8));
      })).toBe(true);
    }
    await expect(dialog.locator('img')).toBeVisible();
    expect(
      await dialog.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0),
    ).toBe(true);
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await dialog.locator('.purchase-guide-layout').evaluate((node) => {
      node.scrollTop = 0;
    });
    await dialog.screenshot({ path: testInfo.outputPath(`guia-${theme}.png`) });
  });
}

test('la guía recorre una compra ficticia sin mutaciones y devuelve el foco', async ({
  page,
  mock,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Cómo comprar', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Así compras en TechStore' });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText('Demostración: no crea pedidos ni reserva productos.'),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Paso 1. Elige un producto' }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Elige un producto', exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Iniciar recorrido', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Siguiente paso' }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Revisa tu carrito', exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Siguiente paso' }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Completa tus datos', exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(/para preparar el pedido y abrir el mensaje/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Siguiente paso' }).click();
  await expect(
    dialog.getByText('Abrir WhatsApp no envía el mensaje ni confirma el pago.'),
  ).toBeVisible();
  await expect(dialog.getByText(/Gracias por acompañarme/)).toBeVisible();
  expect(mock.requests.filter(({ key }) => !key.startsWith('GET '))).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('guía móvil con movimiento reducido conserva pasos estáticos y no desborda', async ({
  page,
  mock,
}) => {
  mock.theme = 'christmas';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Cómo comprar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Así compras en TechStore' });
  const nextButton = dialog.getByRole('button', { name: 'Siguiente paso' });
  const nextBox = await nextButton.boundingBox();
  expect(nextBox.y + nextBox.height).toBeLessThanOrEqual(740);
  await dialog.locator('.purchase-guide-layout').evaluate((node) => { node.scrollTop = node.scrollHeight; });
  const scrolledBox = await nextButton.boundingBox();
  expect(scrolledBox.y).toBeCloseTo(nextBox.y, 0);
  await expect(dialog.getByRole('button', { name: 'Iniciar recorrido', exact: true })).toBeVisible();
  await expect(dialog.getByText(/Animaciones reducidas/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Paso 4. Coordina por WhatsApp' }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Coordina por WhatsApp', exact: true }),
  ).toBeVisible();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Cerrar guía' }).click();
  await expect(dialog).toHaveCount(0);
});

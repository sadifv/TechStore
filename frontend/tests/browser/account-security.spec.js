import { test, expect, product, user } from './fixtures.js';

async function profile(page, mock, role = 'user') {
  mock.role = role;
  mock.handlers.set('GET /api/orders', (route) => route.fulfill({ json: { success: true, orders: [] } }));
  mock.handlers.set('GET /api/addresses', (route) => route.fulfill({ json: { success: true, data: { addresses: [], defaultAddressId: null } } }));
  await page.goto('/profile');
}

test('editar nombre actualiza la cuenta y contraseña exige confirmar identidad', async ({ page, mock }) => {
  let name = user.name;
  mock.handlers.set('GET /api/auth/me', (route) => route.fulfill({ json: { success: true, user: { ...user, role: 'user', name } } }));
  mock.handlers.set('PATCH /api/auth/account/name', async (route) => {
    const body = route.request().postDataJSON();
    expect(Object.keys(body)).toEqual(['name']);
    name = body.name;
    await route.fulfill({ json: { success: true } });
  });
  await profile(page, mock);
  await page.getByText('Editar nombre', { exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Nombre editado');
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  await expect(page.locator('.profile-details')).toContainText('Nombre editado');
  await expect(page.locator('.user-greeting')).toContainText('Nombre editado');
  mock.handlers.set('POST /api/auth/account/password', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.currentPassword).toBe('incorrecta');
    expect(body.password).toBe('new-fixture-password');
    await route.fulfill({ status: 403, json: { success: false, error: 'No se pudo confirmar tu identidad.' } });
  });
  await page.getByText('Cambiar contraseña', { exact: true }).click();
  const form = page.locator('form').filter({ has: page.locator('#account-new-password') });
  await form.getByLabel('Contraseña actual', { exact: true }).fill('incorrecta');
  await form.getByLabel('Nueva contraseña', { exact: true }).fill('new-fixture-password');
  await form.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('alert')).toHaveText('No se pudo confirmar tu identidad.');
  await expect(form.getByLabel('Contraseña actual', { exact: true })).toHaveValue('');
  await expect(form.getByLabel('Nueva contraseña', { exact: true })).toHaveValue('');
});

test('una actualización de sesión tardía no restaura un nombre anterior', async ({ page, mock }) => {
  let read = 0;
  let releaseOld;
  mock.handlers.set('GET /api/auth/me', async (route) => {
    read++;
    const name = read >= 3 ? 'Nombre reciente' : 'Nombre anterior';
    const respond = () => route.fulfill({ json: { success: true, user: { ...user, role: 'user', name } } });
    if (read === 2) return new Promise((resolve) => { releaseOld = async () => { await respond(); resolve(); }; });
    return respond();
  });
  await profile(page, mock);
  await expect(page.locator('.profile-details')).toContainText('Nombre anterior');
  await page.evaluate(() => window.dispatchEvent(new Event('account-updated')));
  await expect.poll(() => Boolean(releaseOld)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('account-updated')));
  await expect(page.locator('.profile-details')).toContainText('Nombre reciente');
  const oldResponse = page.waitForResponse(async (response) =>
    new URL(response.url()).pathname === '/api/auth/me' &&
    (await response.json()).user?.name === 'Nombre anterior');
  await releaseOld();
  await (await oldResponse).finished();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('.profile-details')).toContainText('Nombre reciente');
});

test('correo conserva el actual hasta confirmar y vuelve al login después del cambio', async ({ page, mock }) => {
  mock.handlers.set('POST /api/auth/account/email', async (route) => {
    expect(route.request().postDataJSON().email).toBe('nuevo@example.invalid');
    await route.fulfill({ json: { success: true, message: 'Revisa el nuevo correo.' } });
  });
  mock.handlers.set('POST /api/auth/account/email/confirm', async (route) => {
    expect(route.request().postDataJSON().token).toBe('a'.repeat(64));
    mock.role = 'guest';
    await route.fulfill({ json: { success: true, signInRequired: true } });
  });
  await profile(page, mock);
  await page.getByText('Cambiar correo', { exact: true }).click();
  const form = page.locator('form').filter({ has: page.locator('#account-email') });
  await form.getByLabel('Nuevo correo', { exact: true }).fill('nuevo@example.invalid');
  await form.getByLabel('Contraseña actual', { exact: true }).fill('fixture-current-password');
  await form.getByRole('button', { name: 'Enviar código al nuevo correo' }).click();
  await expect(page.locator('.profile-details')).toContainText(user.email);
  const confirm = page.locator('form').filter({ has: page.locator('#account-email-token') });
  await confirm.getByLabel('Código recibido en el nuevo correo').fill('a'.repeat(64));
  await confirm.getByLabel('Contraseña actual', { exact: true }).fill('fixture-current-password');
  await confirm.getByRole('button', { name: 'Confirmar nuevo correo' }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile&accountUpdated=1/);
  await expect(page.getByText('Datos actualizados. Inicia sesión con tus nuevas credenciales.')).toBeVisible();
});

test('administradores ven el segundo factor y favoritos informa disponibilidad y filtra por nombre', async ({ page, mock }) => {
  mock.handlers.set('GET /api/favorites', (route) => route.fulfill({ json: { success: true, ids: [product._id], items: [{ ...product, name: 'Cámara de prueba', availableStock: 0 }] } }));
  await profile(page, mock, 'admin');
  await page.getByText('Cambiar contraseña', { exact: true }).click();
  await expect(page.getByLabel('Código nuevo de tu aplicación autenticadora', { exact: true }).first()).toBeVisible();
  const favorites = page.locator('.favorites-section');
  await expect(favorites.locator('.favorite-availability')).toContainText('Agotado');
  await page.getByLabel('Buscar en favoritos').fill('camara');
  await expect(favorites.locator('.products-grid > li')).toHaveCount(1);
  await page.getByLabel('Buscar en favoritos').fill('inexistente');
  await expect(favorites.getByText('No hay favoritos que coincidan con tu búsqueda.')).toBeVisible();
  await expect(page.getByLabel('Buscar en favoritos')).toBeFocused();
});

import { test, expect, product } from './fixtures.js';

test('login de cliente envía credenciales y respeta el destino local', async ({ page, mock }) => {
  let submitted;
  mock.handlers.set('POST /api/auth/login', async (route) => {
    submitted = route.request().postDataJSON();
    mock.role = 'user';
    await route.fulfill({ json: { success: true } });
  });
  await page.goto('/login?next=%2Fcatalogo');
  await page.getByLabel('Correo Electrónico', { exact: true }).fill('comprador@example.invalid');
  await page.getByLabel('Contraseña', { exact: true }).fill('FixturePassword123');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(/\/catalogo$/);
  expect(submitted.email).toBe('comprador@example.invalid');
  await expect(page.locator('.user-greeting')).toContainText('Persona ficticia');
});

test('login administrativo exige completar el segundo factor antes de navegar', async ({
  page,
  mock,
}) => {
  mock.handlers.set('POST /api/auth/login', (route) =>
    route.fulfill({ json: { success: true, mfaRequired: true } }),
  );
  mock.handlers.set('POST /api/auth/admin/mfa/verify', async (route) => {
    expect(route.request().postDataJSON().code).toBe('123456');
    mock.role = 'owner';
    await route.fulfill({ json: { success: true } });
  });
  await page.goto('/login?next=%2Fadmin');
  await page.getByLabel('Correo Electrónico', { exact: true }).fill('owner@example.invalid');
  await page.getByLabel('Contraseña', { exact: true }).fill('FixturePassword123');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verifica tu identidad' })).toBeVisible();
  await expect(page).toHaveURL(/\/login\?/);
  await page.getByLabel('Código de autenticación', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
});

test('navegación pública y especificaciones semánticas', async ({ page, mock }) => {
  mock.role = 'guest';
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Catálogo', exact: true })
    .click();
  await expect(page).toHaveURL(/\/catalogo$/);
  await page.locator(`a[href="/producto/${product._id}"]`).first().click();
  await expect(page.getByRole('heading', { name: product.name, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Especificaciones técnicas' })).toBeVisible();
  await expect(page.locator('dl dt').filter({ hasText: 'Panel' })).toBeVisible();
  await expect(page.locator('dl dd').filter({ hasText: 'IPS' })).toBeVisible();
});

test('productos antiguos no muestran sección vacía', async ({ page, mock }) => {
  delete mock.product.specifications;
  await page.goto(`/producto/${product._id}`);
  await expect(page.getByRole('heading', { name: product.name, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Especificaciones técnicas' })).toHaveCount(0);
});

test('401 muestra acceso requerido y 429 permite reintentar sesión', async ({ page, mock }) => {
  await page.goto('/profile');
  await expect(
    page.getByRole('heading', { name: 'Inicia sesión para ver tu cuenta' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Iniciar sesión', exact: true }).last(),
  ).toHaveAttribute('href', '/login?next=%2Fprofile');
  mock.sessionStatus = 429;
  await page.reload();
  await expect(page.getByRole('alert')).toHaveText('Demasiadas solicitudes de prueba.');
  await expect(page.getByRole('heading', { name: 'No pudimos comprobar tu sesión' })).toBeVisible();
  mock.sessionStatus = 0;
  await page.getByRole('button', { name: 'Volver a comprobar' }).click();
  await expect(
    page.getByRole('heading', { name: 'Inicia sesión para ver tu cuenta' }),
  ).toBeVisible();
});

test('carrito invitado persiste y checkout conserva la clave al reintentar errores', async ({
  page,
  mock,
}) => {
  const attempts = [];
  mock.handlers.set('POST /api/orders/checkout', async (route) => {
    attempts.push(route.request().postDataJSON());
    await route.fulfill({
      status: 503,
      json: { success: false, error: `Error simulado ${attempts.length}; reintenta.` },
    });
  });
  await page.goto(`/producto/${product._id}`);
  await page.getByRole('button', { name: 'Añadir al carrito', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Ver carrito, 1 productos' }).click();
  await expect(page.locator('#cart-total')).toHaveText('$329.00');
  await page.getByRole('button', { name: 'Proceder al Pago', exact: true }).click();
  await page.getByLabel('Nombre Completo', { exact: true }).fill('Persona ficticia');
  await page.getByLabel('Correo electrónico de contacto').fill('comprador@example.invalid');
  const submit = page.getByRole('button', { name: 'Continuar por WhatsApp', exact: true });
  await submit.click();
  await expect(page.locator('#checkout-status')).toHaveText('Error simulado 1; reintenta.');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('#checkout-status')).toHaveText('Error simulado 2; reintenta.');
  expect(attempts).toHaveLength(2);
  expect(attempts[0].checkoutKey).toBeTruthy();
  expect(attempts[1]).toEqual(attempts[0]);
  await expect(page).toHaveURL(new RegExp(`/producto/${product._id}$`));
});

test('owner guarda y aplica los tres temas globales', async ({ page, mock }) => {
  mock.role = 'owner';
  await page.goto('/admin/dashboard');
  for (const theme of ['halloween', 'christmas', 'normal']) {
    await page.getByLabel('Tema', { exact: true }).selectOption(theme);
    await page.getByRole('button', { name: 'Guardar tema global' }).click();
    await expect(page.getByText('Tema guardado.', { exact: false })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(mock.theme).toBe(theme);
  }
});

test('editor añade, retira y envía especificaciones en FormData', async ({ page, mock }) => {
  mock.role = 'owner';
  let body;
  mock.handlers.set(`PUT /api/admin/products/${product._id}`, async (route) => {
    body = route.request().postData();
    await route.fulfill({ json: { success: true } });
  });
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByRole('button', { name: 'Añadir característica', exact: true }).click();
  await editor.getByLabel('Nombre de característica 3', { exact: true }).fill('Frecuencia');
  await editor.getByLabel('Valor de característica 3', { exact: true }).fill('144 Hz');
  await editor.getByRole('button', { name: 'Eliminar característica 2', exact: true }).click();
  await expect(editor.getByLabel('Valor de característica 2', { exact: true })).toHaveValue(
    '144 Hz',
  );
  await expect(
    editor.getByLabel('URL de imagen (si no subes un archivo)', { exact: true }),
  ).toHaveValue('');
  await editor.getByRole('button', { name: 'Guardar producto', exact: true }).click();
  await expect(editor).not.toBeVisible();
  expect(body).toContain('name="specifications"');
  expect(body).toContain(
    JSON.stringify([
      { name: 'Panel', value: 'IPS' },
      { name: 'Frecuencia', value: '144 Hz' },
    ]),
  );
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await editor.getByRole('button', { name: 'Eliminar característica 2', exact: true }).click();
  await editor.getByRole('button', { name: 'Eliminar característica 1', exact: true }).click();
  await expect(
    editor.getByLabel('URL de imagen (si no subes un archivo)', { exact: true }),
  ).toHaveValue('');
  await editor.getByRole('button', { name: 'Guardar producto', exact: true }).click();
  await expect(editor).not.toBeVisible();
  expect(body).toMatch(/name="specifications"\r\n\r\n\[\]/);
});

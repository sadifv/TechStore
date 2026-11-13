import { test, expect, product } from './fixtures.js';

test('TechBot conserva una respuesta nueva cuando el historial inicial llega tarde', async ({ page, mock }) => {
  mock.role = 'user';
  let releaseHistory;
  mock.handlers.set('GET /api/ai/history', (route) => new Promise((resolve) => {
    releaseHistory = async () => {
      await route.fulfill({ json: {
        success: true,
        history: [{ role: 'assistant', content: 'Historial anterior de prueba' }],
      } });
      resolve();
    };
  }));
  mock.handlers.set('POST /api/ai/chat', (route) =>
    route.fulfill({ json: { success: true, reply: 'Respuesta nueva de prueba', products: [] } }),
  );
  await page.goto('/#ai-assistant');
  await expect.poll(() => Boolean(releaseHistory)).toBe(true);
  await page.locator('#ai-chat-input').fill('Consulta nueva');
  await page.locator('#ai-chat-form').getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByText('Respuesta nueva de prueba', { exact: true }).last()).toBeVisible();
  await releaseHistory();
  await expect(page.locator('.ai-history').getByText('Respuesta nueva de prueba')).toBeVisible();
  await expect(page.locator('.ai-history').getByText('Historial anterior de prueba')).toHaveCount(0);
});

test('TechBot permite editar una sugerencia y muestra el producto de la respuesta', async ({
  page,
  mock,
}) => {
  mock.role = 'user';
  mock.handlers.set('GET /api/ai/history', (route) =>
    route.fulfill({ json: { success: true, history: [] } }),
  );
  mock.handlers.set('POST /api/ai/chat', (route) =>
    route.fulfill({
      json: {
        success: true,
        reply: 'Puedes consultar el Monitor de prueba.',
        products: [product],
      },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#ai-assistant');
  const input = page.locator('#ai-chat-input');
  await expect(page.getByRole('button', { name: 'Limpiar conversación' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Quiero una laptop' }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Busco una laptop para ___ y mi presupuesto es de $___');
  expect(mock.requests.filter(({ key }) => key === 'POST /api/ai/chat')).toEqual([]);
  await input.fill('Busco un monitor');
  await page.locator('#ai-chat-form').getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.locator('.ai-mentioned-products a')).toHaveAttribute(
    'href',
    `/producto/${product._id}`,
  );
  await expect(page.getByRole('button', { name: 'Limpiar conversación' })).toBeVisible();
  await expect(page.locator('.shop-prompts')).toHaveCount(0);
  const box = await input.boundingBox();
  expect(box.width).toBeGreaterThan(50);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('TechBot pregunta por uso y presupuesto sin recomendar productos a invitados', async ({
  page,
  mock,
}) => {
  await page.goto('/#ai-assistant');
  const preview = page.locator('.techbot-preview');
  await expect(preview.getByRole('heading', { name: 'Ejemplo de conversación' })).toBeVisible();
  await expect(preview.getByText('¿Qué programas vas a usar y cuál es tu presupuesto máximo?')).toBeVisible();
  await expect(preview.locator('.techbot-example-product')).toHaveCount(0);
  await expect(preview.getByRole('link', { name: 'Crear cuenta', exact: true })).toHaveAttribute(
    'href',
    '/register?next=%2F%23ai-assistant',
  );
  await expect(page.locator('#ai-chat-input')).toHaveCount(0);
  expect(mock.requests.filter(({ key }) => key.includes('/api/ai/'))).toEqual([]);
});

test('TechBot conserva el chat y la carga de historial para usuarios con sesión', async ({
  page,
  mock,
}) => {
  mock.role = 'user';
  mock.handlers.set('GET /api/ai/history', (route) =>
    route.fulfill({ json: { success: true, history: [] } }),
  );
  await page.goto('/#ai-assistant');
  await expect(page.locator('#ai-chat-input')).toBeVisible();
  await expect(page.locator('.techbot-preview')).toHaveCount(0);
  await expect
    .poll(() => mock.requests.some(({ key }) => key === 'GET /api/ai/history'))
    .toBe(true);
});

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
  await expect(page.locator('#cart-total')).toHaveText('$329,00');
  await page.getByRole('button', { name: 'Continuar con el pedido', exact: true }).click();
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

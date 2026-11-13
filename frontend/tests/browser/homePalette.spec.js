import { test, expect } from './fixtures.js';

async function checkContrast(page, selectors) {
  const results = await page.evaluate((selectors) => {
    const rgb = (value) => value.match(/[\d.]+/g).map(Number);
    const luminance = (color) =>
      rgb(color)
        .slice(0, 3)
        .map((v) => {
          const x = v / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    return selectors.map((selector) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`Missing contrast sample: ${selector}`);
      let surface = node;
      while (surface.parentElement && rgb(getComputedStyle(surface).backgroundColor)[3] === 0)
        surface = surface.parentElement;
      const fg = luminance(getComputedStyle(node).color);
      const bg = luminance(getComputedStyle(surface).backgroundColor);
      return { selector, ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05) };
    });
  }, selectors);
  expect(
    results.filter((result) => result.ratio < 4.5),
    'Representative text contrast below 4.5:1',
  ).toEqual([]);
}

for (const theme of ['normal', 'halloween', 'christmas']) {
  test(`paleta continua, contraste y adaptación de la portada en ${theme}`, async ({
    page,
    mock,
  }, testInfo) => {
    mock.theme = theme;
    const images = [
      'lg-ultragear-27-ref.jpg',
      'shure-sm7b-ref.jpg',
      'logitech-brio-4k-ref.jpg',
      'samsung-odyssey-g9-ref.jpg',
    ];
    mock.handlers.set('GET /api/products/home', (route) =>
      route.fulfill({
        json: {
          success: true,
          products: images.map((image, index) => ({
            ...mock.product,
            _id: String(index + 1).padStart(24, '0'),
            name: `Producto de prueba ${index + 1}`,
            image: `/images/products/${image}`,
          })),
          categoryImages: [{ _id: 'Audio', image: '/images/products/shure-sm7b-ref.jpg' }],
          flashSale: null,
        },
      }),
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.locator('.home-storefront')).toBeAttached();
      await expect(page.locator('#featured-grid .product-card').first()).toBeVisible();
      await expect(page.locator('#contacto')).toBeAttached();
      await checkContrast(page, [
        '#featured-heading',
        '.product-card h3',
        '.product-price',
        '.product-card .add-to-cart-btn',
        '.editorial-controls button',
        '.techbot-example-answer p',
        '#ai-title',
        '#newsletter-email',
        '#contact-name',
        '#contact-title',
        '.contact-info-item a',
      ]);
      const sections = [
        '#destacados',
        '#home-categories',
        '.build-experience',
        '#ai-assistant',
        '.newsletter-section',
        '#contacto',
      ];
      for (const selector of sections) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.locator(selector).screenshot({
          path: testInfo.outputPath(`${theme}-${width}-${selector.replace(/[^a-z0-9]/gi, '')}.png`),
          animations: 'disabled',
        });
      }
    }
  });
}

test('los formularios mantienen sus envíos y los mensajes conservan contraste', async ({
  page,
  mock,
}) => {
  let fail = true;
  mock.handlers.set('POST /api/newsletter', (route) =>
    route.fulfill({
      status: fail ? 503 : 201,
      json: fail
        ? { success: false, error: 'Servicio de prueba temporalmente no disponible.' }
        : { success: true, message: '¡Solicitud recibida!' },
    }),
  );
  mock.handlers.set('POST /api/contact', (route) => route.fulfill({ json: { success: true } }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .first()
    .fill('prueba@example.invalid');
  await page.locator('#newsletter-consent').check();
  await page.getByRole('button', { name: 'Suscribirme', exact: true }).click();
  await expect(page.getByText('Servicio de prueba temporalmente no disponible.')).toBeVisible();
  await checkContrast(page, ['#newsletter-status']);
  fail = false;
  await page.getByRole('button', { name: 'Suscribirme', exact: true }).click();
  await expect(page.getByText('¡Solicitud recibida!')).toBeVisible();
  await checkContrast(page, ['#newsletter-status']);
  await page.locator('#contact-name').fill('Persona de prueba');
  await page.locator('#contact-email').fill('prueba@example.invalid');
  await page.locator('#contact-message').fill('Consulta ficticia para verificar el formulario.');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.getByText('¡Mensaje enviado con éxito!')).toBeVisible();
  expect(mock.requests.filter(({ key }) => key === 'POST /api/contact')).toHaveLength(1);
});

test('TechBot con sesión conserva el contraste de mensajes y del campo de escritura', async ({
  page,
  mock,
}) => {
  mock.role = 'user';
  mock.handlers.set('GET /api/ai/history', (route) =>
    route.fulfill({ json: { success: true, history: [] } }),
  );
  mock.handlers.set('POST /api/ai/chat', (route) =>
    route.fulfill({
      json: { success: true, reply: 'Respuesta de prueba para el contraste.', products: [] },
    }),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#ai-assistant');
  await page.locator('#ai-chat-input').fill('Busco un monitor');
  await page.locator('#ai-chat-form').getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(
    page.locator('.ai-history').getByText('Respuesta de prueba para el contraste.'),
  ).toBeVisible();
  await checkContrast(page, [
    '.ai-header h2',
    '.ai-message-user p',
    '.ai-message-bot p',
    '#ai-chat-input',
  ]);
});

for (const theme of ['normal', 'halloween', 'christmas']) {
  test(`paleta global en catálogo, configurador, acceso y admin: ${theme}`, async ({
    page,
    mock,
  }, testInfo) => {
    mock.theme = theme;
    mock.role = 'owner';
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const routes = [
      ['/catalogo', '.product-card', ['h1', '.product-price', '.add-to-cart-btn']],
      [
        '/arma-tu-equipo',
        '.build-kit-panel',
        ['h1', '.build-kit-panel legend', '.build-kit-types label'],
      ],
      ['/login', '.login-card', ['h1', 'label', 'input[type="email"]']],
      ['/admin', '.stat-card', ['h1', '.stat-number', '.admin-table th']],
    ];
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [path, surface, samples] of routes) {
        await page.goto(path);
        await expect(page.locator(surface).first()).toBeVisible();
        await expect(page.locator('body')).toHaveCSS('background-color', ({ normal: 'rgb(9, 15, 27)', halloween: 'rgb(16, 11, 26)', christmas: 'rgb(8, 22, 16)' })[theme]);
        await checkContrast(page, [...samples, '.navbar .btn-primary']);
        await page.screenshot({
          path: testInfo.outputPath(`global-${theme}-${width}-${path.slice(1)}.png`),
        });
      }
    }
  });
}

test('ficha, carrito y checkout comparten superficies legibles sin mutaciones reales', async ({
  page,
  mock,
}, testInfo) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/producto/${mock.product._id}`);
    await expect(page.locator('.product-detail-price')).toBeVisible();
    await checkContrast(page, ['h1', '.product-detail-price']);
    if (width === 390)
      await page.getByRole('button', { name: 'Añadir al carrito', exact: true }).click();
    if (width === 390) await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.getByRole('button', { name: 'Ver carrito, 1 productos' }).click();
    await expect(page.locator('#cart-total')).toHaveText('$329,00');
    await checkContrast(page, ['.cart-drawer-header h2', '.cart-item-details h4', '#cart-total']);
    await page.screenshot({ path: testInfo.outputPath(`cart-${width}.png`) });
    await page.getByRole('button', { name: 'Continuar con el pedido', exact: true }).click();
    await expect(page.getByLabel('Nombre Completo', { exact: true })).toBeVisible();
    await checkContrast(page, ['#guest-name', '#guest-email']);
    await page.screenshot({ path: testInfo.outputPath(`checkout-${width}.png`) });
    await page.keyboard.press('Escape');
  }
});

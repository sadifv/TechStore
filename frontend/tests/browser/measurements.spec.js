import { test, expect } from './fixtures.js';
import process from 'node:process';

test.skip(process.env.TEST_VERCEL_MEASUREMENTS !== '1', 'Requiere el servidor local de métricas simuladas.');

async function mockMeasurementScripts(page) {
  const received = [];
  await page.route('**/_vercel/**', async (route) => {
    const url = route.request().url();
    if (!url.endsWith('/script.js')) {
      received.push({
        body: route.request().postDataJSON(),
        referrer: route.request().headers().referer,
      });
      return route.fulfill({ json: { success: true } });
    }
    const speed = url.includes('speed-insights');
    return route.fulfill({
      contentType: 'application/javascript',
      body: `
      (() => {
        const queue = window.${speed ? 'siq' : 'vaq'} || [];
        const hook = queue.find(item => item[0] === 'beforeSend')[1];
        window.${speed ? 'testSpeedHook' : 'testAnalyticsHook'} = hook;
        const event = hook({type:'${speed ? 'vital' : 'pageview'}',url:location.href${speed ? ",route:'/private/token'" : ''}});
        if (event) fetch('/_vercel/${speed ? 'speed-insights/vitals' : 'insights/view'}', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)});
      })();`,
    });
  });
  return received;
}

test('public telemetry uses the SDK hooks and removes query/hash/referrer data', async ({
  page,
  mock,
}) => {
  mock.role = 'guest';
  const received = await mockMeasurementScripts(page);
  await page.goto('/catalogo?q=private%40example.test#token-example');
  await expect.poll(() => received.length).toBe(2);
  for (const item of received) {
    expect(item.body.url).toBe('http://127.0.0.1:4175/catalogo');
    expect(item.referrer).toBeUndefined();
    expect(JSON.stringify(item.body)).not.toContain('private');
  }
  const dropped = await page.evaluate(() => [
    window.testAnalyticsHook({ type: 'pageview', url: location.origin + '/reset-password/secret' }),
    window.testSpeedHook({ type: 'vital', url: location.origin + '/profile' }),
    window.testAnalyticsHook({ type: 'event', url: location.href, name: 'personal' }),
  ]);
  expect(dropped).toEqual([null, null, null]);
});

test('private routes do not inject measurement scripts', async ({ page, mock }) => {
  mock.role = 'owner';
  const received = await mockMeasurementScripts(page);
  for (const path of [
    '/admin/dashboard',
    '/admin/categorias',
    '/login',
    '/forgot-password',
    '/reset-password/secret',
  ]) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('script[src*="/_vercel/"]')).toHaveCount(0);
  }
  expect(received).toEqual([]);
});

test('sensitive incoming referrers suppress SDK initialization', async ({ page, mock }) => {
  mock.role = 'guest';
  const received = await mockMeasurementScripts(page);
  await page.goto('/catalogo', { referer: 'https://outside.example/private?email=secret' });
  await expect(page.getByRole('heading', { name: 'Nuestro Catálogo' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('script[src*="/_vercel/"]')).toHaveCount(0);
  expect(received).toEqual([]);
});

for (const theme of ['normal', 'halloween', 'christmas']) {
  test(`aviso de privacidad legible en ${theme}`, async ({ page, mock }, testInfo) => {
    mock.theme = theme;
    await mockMeasurementScripts(page);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/legal');
      await expect(
        page.getByRole('heading', { name: 'Métricas de uso y rendimiento' }),
      ).toBeVisible();
      await expect(page.locator('.logo-intro')).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page
        .getByRole('heading', { name: 'Métricas de uso y rendimiento' })
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`privacy-${theme}-${width}.png`) });
    }
  });
}

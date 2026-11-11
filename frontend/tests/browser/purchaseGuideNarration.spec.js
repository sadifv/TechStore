import { test, expect } from './fixtures.js';

async function mockAudio(page) {
  await page.addInitScript(() => {
    window.guideAudioTest = { sources: [], paused: 0, current: null };
    window.Audio = class {
      play() {
        window.guideAudioTest.sources.push(this.src);
        window.guideAudioTest.current = this;
        return Promise.resolve();
      }
      pause() { window.guideAudioTest.paused += 1; }
      removeAttribute() {}
      load() {}
    };
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
  });
}

test('los audios locales funcionan sin voces instaladas y se detienen al cambiar o cerrar', async ({ page, mock }) => {
  await mockAudio(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Cómo comprar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Así compras en TechStore' });
  expect(await page.evaluate(() => window.guideAudioTest.sources)).toEqual([]);
  await dialog.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await dialog.getByRole('button', { name: 'Escuchar este paso', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Reproducir', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Detener audio', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.guideAudioTest.sources)).toEqual(['/audio/como-comprar/paso-1.mp3']);
  await dialog.getByRole('button', { name: 'Siguiente paso' }).click();
  expect(await page.evaluate(() => window.guideAudioTest.paused)).toBe(1);
  await dialog.getByRole('button', { name: 'Escuchar este paso', exact: true }).click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.guideAudioTest.sources.at(-1))).toBe('/audio/como-comprar/paso-2.mp3');
  expect(await page.evaluate(() => window.guideAudioTest.paused)).toBe(2);
  expect(mock.requests.filter(({ key }) => !key.startsWith('GET '))).toEqual([]);
});

test('la narración permite detener, terminar y reintentar errores', async ({ page, mock }) => {
  await mockAudio(page);
  mock.theme = 'halloween';
  await page.goto('/');
  await page.getByRole('button', { name: 'Cómo comprar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Así compras en TechStore' });
  const listen = dialog.getByRole('button', { name: 'Escuchar este paso', exact: true });
  await listen.click();
  await dialog.getByRole('button', { name: 'Detener audio', exact: true }).click();
  await expect(listen).toBeVisible();
  await listen.click();
  await page.evaluate(() => window.guideAudioTest.current.onended());
  await expect(listen).toBeVisible();
  await listen.click();
  await page.evaluate(() => window.guideAudioTest.current.onerror());
  await expect(dialog.getByText('No se pudo reproducir el audio. Puedes reintentarlo o leer el paso.')).toBeVisible();
  await listen.click();
  await expect(dialog.getByRole('button', { name: 'Detener audio', exact: true })).toBeVisible();
});

test('los cuatro MP3 locales se pueden decodificar y no se descargan al abrir la guía', async ({ page, mock }) => {
  mock.theme = 'christmas';
  const audioRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/audio/como-comprar/')) audioRequests.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Cómo comprar', exact: true }).click();
  expect(audioRequests).toEqual([]);
  const durations = await page.evaluate(async () => {
    const context = new AudioContext();
    try {
      const durations = [];
      for (let step = 1; step <= 4; step += 1) {
        const response = await fetch(`/audio/como-comprar/paso-${step}.mp3`);
        if (!response.ok) throw new Error(`Audio ${step}: ${response.status}`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        durations.push(buffer.duration);
      }
      return durations;
    } finally { await context.close(); }
  });
  for (const duration of durations) {
    expect(duration).toBeGreaterThan(5);
    expect(duration).toBeLessThan(35);
  }
});

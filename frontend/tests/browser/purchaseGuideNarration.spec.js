import { test, expect } from './fixtures.js';

async function mockAudio(page) {
  await page.addInitScript(() => {
    window.guideAudioTest = { sources: [], starts: [], paused: 0, current: null };
    window.Audio = class {
      constructor() {
        this.currentTime = 0;
        this.lastSource = '';
      }
      play() {
        const test = window.guideAudioTest;
        if (this.src !== this.lastSource) test.sources.push(this.src);
        test.starts.push({ source: this.src, time: this.currentTime });
        test.current = this;
        this.lastSource = this.src;
        this.currentTime = 12;
        return Promise.resolve();
      }
      pause() { window.guideAudioTest.paused += 1; }
      removeAttribute() {
        this.src = '';
        this.currentTime = 0;
      }
      load() {}
    };
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
  });
}

test('la narración reanuda desde la posición pausada y se detiene al cambiar de escena o cerrar', async ({ page, mock }) => {
  await mockAudio(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Cómo comprar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Así compras en TechStore' });
  expect(await page.evaluate(() => window.guideAudioTest.sources)).toEqual([]);
  await dialog.getByRole('button', { name: 'Iniciar recorrido', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Pausar narración', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.guideAudioTest.sources)).toEqual(['/audio/como-comprar/paso-1.mp3']);
  await dialog.getByRole('button', { name: 'Pausar narración', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Reanudar narración', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.guideAudioTest.paused)).toBe(1);
  await dialog.getByRole('button', { name: 'Reanudar narración', exact: true }).click();
  expect(await page.evaluate(() => window.guideAudioTest.starts)).toEqual([
    { source: '/audio/como-comprar/paso-1.mp3', time: 0 },
    { source: '/audio/como-comprar/paso-1.mp3', time: 12 },
  ]);
  await dialog.getByRole('button', { name: 'Siguiente paso' }).click();
  expect(await page.evaluate(() => window.guideAudioTest.paused)).toBe(2);
  await dialog.getByRole('button', { name: 'Iniciar recorrido', exact: true }).click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.guideAudioTest.sources.at(-1))).toBe('/audio/como-comprar/paso-2.mp3');
  expect(await page.evaluate(() => window.guideAudioTest.paused)).toBe(3);
  expect(mock.requests.filter(({ key }) => !key.startsWith('GET '))).toEqual([]);
});

test('el audio real conserva la posición al pausar y reanudar sin repetir la escena', async ({ page, mock }) => {
  mock.role = 'guest';
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.guideRealAudio = { instances: [], starts: [] };
    window.Audio = class extends NativeAudio {
      constructor(...args) {
        super(...args);
        window.guideRealAudio.instances.push(this);
        this.addEventListener('play', () => {
          window.guideRealAudio.starts.push({ source: this.currentSrc, time: this.currentTime });
        });
      }
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Cómo comprar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Así compras en TechStore' });
  await dialog.getByRole('button', { name: 'Iniciar recorrido', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.guideRealAudio.instances[0]?.currentTime || 0)).toBeGreaterThan(0.1);
  await dialog.getByRole('button', { name: 'Pausar narración', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Reanudar narración', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.guideRealAudio.instances[0].paused)).toBe(true);

  // Seek while paused to a known position; the browser must resume that same MP3 there.
  await page.evaluate(() => { window.guideRealAudio.instances[0].currentTime = 4.25; });
  await expect.poll(() => page.evaluate(() => window.guideRealAudio.instances[0].seeking)).toBe(false);
  await dialog.getByRole('button', { name: 'Reanudar narración', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.guideRealAudio.starts.length)).toBe(2);
  const result = await page.evaluate(() => ({
    instances: window.guideRealAudio.instances.length,
    resumed: window.guideRealAudio.starts[1],
  }));
  expect(result.instances).toBe(1);
  expect(result.resumed.source).toContain('/audio/como-comprar/paso-1.mp3');
  expect(result.resumed.time).toBeGreaterThanOrEqual(4.2);
  expect(result.resumed.time).toBeLessThan(4.75);
  await expect(dialog.getByRole('heading', { name: 'Conoce TechStore', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.guideRealAudio.instances[0].paused)).toBe(true);
});

test('la narración sincroniza las cinco escenas, termina y permite reintentar errores', async ({ page, mock }) => {
  await mockAudio(page);
  mock.theme = 'halloween';
  await page.goto('/');
  await page.getByRole('button', { name: 'Cómo comprar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Así compras en TechStore' });
  const listen = dialog.getByRole('button', { name: 'Iniciar recorrido', exact: true });
  await listen.click();
  for (const [step, title] of [
    [2, 'Elige un producto'],
    [3, 'Revisa tu carrito'],
    [4, 'Completa tus datos'],
    [5, 'Coordina por WhatsApp'],
  ]) {
    await page.evaluate(() => window.guideAudioTest.current.onended());
    await expect(dialog.getByRole('heading', { name: title, exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.guideAudioTest.sources.at(-1)))
      .toBe(`/audio/como-comprar/paso-${step}.mp3`);
  }
  await page.evaluate(() => window.guideAudioTest.current.onended());
  await expect(dialog.getByRole('button', { name: 'Volver a escuchar', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.guideAudioTest.sources)).toHaveLength(5);
  await dialog.getByRole('button', { name: 'Volver a escuchar', exact: true }).click();
  await page.evaluate(() => window.guideAudioTest.current.onerror());
  const retry = dialog.getByRole('button', { name: 'Iniciar recorrido', exact: true });
  await expect(dialog.getByText('No se pudo reproducir la narración. Puedes leer el recorrido.')).toBeVisible();
  await retry.click();
  await expect(dialog.getByRole('button', { name: 'Pausar narración', exact: true })).toBeVisible();
});

test('los cinco MP3 locales se pueden decodificar y no se descargan al abrir la guía', async ({ page, mock }) => {
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
      for (let step = 1; step <= 5; step += 1) {
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

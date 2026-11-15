import { expect } from '@playwright/test';

export async function checkContrast(page, selectors) {
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
      return {
        selector,
        text: node.textContent.trim().slice(0, 80),
        ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05),
      };
    });
  }, selectors);
  expect(
    results.filter((result) => result.ratio < 4.5),
    'Representative text contrast below 4.5:1',
  ).toEqual([]);
}

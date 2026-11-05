const themes = new Set(['normal', 'halloween', 'christmas']);
export function applyTheme(value) {
  const theme = themes.has(value) ? value : 'normal';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    {
      normal: '#2563eb',
      halloween: '#a83d0a',
      christmas: '#af2339',
    }[theme],
  );
  window.dispatchEvent(new CustomEvent('store-theme-changed', { detail: theme }));
}

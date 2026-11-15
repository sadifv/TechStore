const publicPages = new Set(['/', '/catalogo', '/arma-tu-equipo', '/arma-tu-pc', '/legal']);

export function measurementPath(pathname) {
  if (publicPages.has(pathname)) return pathname;
  if (/^\/producto\/[a-f\d]{24}$/i.test(pathname)) return '/producto/[id]';
  return null;
}

export function safeMeasurementEvent(event, origin) {
  if (!event || !['pageview', 'vital'].includes(event.type)) return null;
  try {
    const url = new URL(event.url, origin);
    const path = measurementPath(url.pathname);
    if (url.origin !== origin || url.username || url.password || !path) return null;
    // Queries, fragments and arbitrary route values never reach telemetry.
    return {
      ...event,
      url: `${origin}${path}`,
      ...(event.type === 'vital' ? { route: path } : {}),
    };
  } catch {
    return null;
  }
}

export function safeMeasurementReferrer(referrer, origin) {
  if (!referrer) return true;
  try {
    const url = new URL(referrer);
    if (url.username || url.password || url.search || url.hash) return false;
    return url.origin === origin ? !!measurementPath(url.pathname) : url.pathname === '/';
  } catch {
    return false;
  }
}

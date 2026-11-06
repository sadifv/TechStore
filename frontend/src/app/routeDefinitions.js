import { decodeRouteSegment } from './routeSegments.js';

const exactRoutes = {
  '/': 'home',
  '/catalogo': 'catalog',
  '/login': 'login',
  '/register': 'register',
  '/profile': 'profile',
  '/avisos/confirmar': 'restock',
  '/avisos/baja': 'restock',
  '/legal': 'legal',
  '/forgot-password': 'forgot',
  '/api/marketing/unsubscribe': 'unsubscribe',
  '/marketing/unsubscribe': 'unsubscribe',
  '/pedido-enviado': 'checkout',
  '/error': 'error',
  '/admin': 'dashboard',
  '/admin/dashboard': 'dashboard',
  '/admin/marketing': 'marketing',
  '/admin/orders': 'orders',
  '/admin/users': 'users',
  '/admin/reviews': 'reviews',
  '/admin/audit': 'audit',
};
const dynamicRoutes = [
  { name: 'product', pattern: /^\/producto\/([^/]+)$/ },
  { name: 'reset', pattern: /^\/reset-password\/([^/]+)$/ },
  { name: 'unsubscribe', pattern: /^\/(?:api\/)?newsletter\/unsubscribe\/([^/]+)$/ },
  { name: 'packing', pattern: /^\/admin\/orders\/([^/]+)\/packing-slip$/, standalone: true },
  { name: 'order', pattern: /^\/admin\/orders\/([^/]+)$/ },
];

export function matchRoute(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (Object.hasOwn(exactRoutes, path)) return { name: exactRoutes[path], standalone: false };
  for (const route of dynamicRoutes) {
    const match = path.match(route.pattern);
    if (!match) continue;
    const parameter = decodeRouteSegment(match[1]);
    return {
      name: parameter === null ? 'notFound' : route.name,
      parameter,
      standalone: !!route.standalone,
    };
  }
  return { name: 'notFound', standalone: false };
}

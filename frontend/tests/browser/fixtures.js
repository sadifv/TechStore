import { test as base, expect } from '@playwright/test';

export const product = {
  _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  name: 'Monitor de prueba',
  category: 'Monitores',
  price: 329,
  stock: 8,
  availableStock: 8,
  image: '/images/products/product-placeholder.svg',
  description: 'Producto ficticio para pruebas.',
  specifications: [
    { name: 'Panel', value: 'IPS' },
    { name: 'Resolución', value: '2560 × 1440' },
  ],
};
export const user = {
  id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  name: 'Persona ficticia',
  email: 'prueba@example.invalid',
  role: 'owner',
};

// Every API is fulfilled locally. Unknown calls fail the test instead of contacting Express.
export const test = base.extend({
  mock: async ({ context }, provide) => {
    const state = {
      role: 'guest',
      sessionStatus: 0,
      theme: 'normal',
      product: structuredClone(product),
      handlers: new Map(),
      requests: [],
    };
    const unexpected = [];
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== 'http://127.0.0.1:4175') return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const key = `${request.method()} ${url.pathname}`;
      state.requests.push({ key, url: request.url(), body: request.postData() });
      if (state.handlers.has(key)) return state.handlers.get(key)(route);
      let json = { success: true };
      let status = 200;
      switch (key) {
        case 'GET /api/auth/me':
          status = state.sessionStatus || (state.role === 'guest' ? 401 : 200);
          json =
            status === 200
              ? { success: true, user: { ...user, role: state.role } }
              : {
                  success: false,
                  error:
                    status === 429 ? 'Demasiadas solicitudes de prueba.' : 'Sin sesión de prueba.',
                };
          break;
        case 'GET /api/store/appearance':
          json.theme = state.theme;
          break;
        case 'GET /api/store/collections':
        case 'GET /api/admin/collections':
          json.collections = {};
          break;
        case 'GET /api/store/config':
          json.whatsappPhone = '593000000000';
          break;
        case 'GET /api/products/home':
          Object.assign(json, { products: [state.product], flashSale: null });
          break;
        case 'GET /api/products':
          Object.assign(json, {
            products: [state.product],
            pagination: { currentPage: 1, totalPages: 1, totalCount: 1 },
          });
          break;
        case `GET /api/products/${product._id}`:
          json.data = state.product;
          break;
        case `GET /api/products/${product._id}/reviews`:
          json.data = { reviews: [], count: 0, average: 0, page: 1, totalPages: 1 };
          break;
        case 'GET /api/reviews/mine':
          json.data = { review: null, eligible: false };
          break;
        case 'GET /api/favorites':
          Object.assign(json, { ids: [], items: [] });
          break;
        case 'GET /api/cart':
          json.items = [];
          break;
        case 'POST /api/presence/heartbeat':
          break;
        case 'GET /api/admin/dashboard':
          json.data = {
            products: [state.product],
            orders: [],
            topProducts: [],
            messages: [],
            subscribers: [],
            subscriberPagination: { currentPage: 1, totalPages: 1, totalSubscribers: 0 },
            totalOrders: 0,
            totalRevenue: 0,
            totalProductsSold: 0,
            activeCartCount: 0,
          };
          break;
        case 'PATCH /api/admin/appearance':
          state.theme = request.postDataJSON().theme;
          json.theme = state.theme;
          break;
        default:
          unexpected.push(key);
          status = 501;
          json = { success: false, error: 'Endpoint sin fixture.' };
      }
      return route.fulfill({ status, json });
    });
    await provide(state);
    expect(unexpected, 'Todas las APIs deben tener un mock explícito').toEqual([]);
  },
});
export { expect };

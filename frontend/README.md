# TechStore Frontend

React and Vite frontend for the TechStore application. The existing Express application remains the API server during this migration.

## Local development

Run the backend from the `backend/` directory in one terminal:

```sh
npm run dev
```

Run the React frontend from this directory in a second terminal:

```sh
npm run dev
```

Open the Vite URL shown in the frontend terminal (normally `http://localhost:5173`). Vite proxies API and form requests to `http://localhost:3001`; both processes must be running for data, authentication, cart, and checkout features to work. To use another local backend address, copy `.env.example` to `.env.local` and set `BACKEND_PROXY_TARGET`.

Vite serves the existing shared stylesheet and public assets from the project `public` directory. React owns the storefront pages listed in `src/App.jsx`; API requests continue to use the current Express endpoints.

## Membership display settings

The backend remains authoritative for membership checkout amounts and coupon rules. The public React display uses the matching defaults below. If the backend `.env` overrides these values, set the corresponding `VITE_` values in a local `frontend/.env` so the displayed terms stay in sync:

```env
VITE_VIP_MONTHLY_PRICE=4.99
VITE_VIP_COUPON_MIN_ORDER=50
VITE_VIP_WELCOME_DISCOUNT_PERCENT=15
VITE_VIP_WELCOME_MAX_DISCOUNT=10
VITE_VIP_MONTHLY_DISCOUNT_PERCENT=10
VITE_VIP_MONTHLY_MAX_DISCOUNT=8
```

## API URL and deployment

`VITE_API_BASE_URL` controls where React sends API requests and uploaded-image requests. Leave it empty when a reverse proxy serves the React app and forwards `/api/` and `/uploads/` to Express on the same domain. For separate subdomains on the same site, set it to the API origin (for example, `https://api.tu-dominio.com`) before running `npm run build`; Vite embeds this value in the production bundle. Do not add `/api` to the base URL.

For production, publish `dist/` as the React site and run Express separately. Set backend `APP_URL` and `FRONTEND_URL` to the public React URL, and set `ALLOWED_ORIGINS` to that exact origin. Use HTTPS and keep the frontend and API on the same site so the session cookie works. See the root README for the deployment setup and environment examples.

## Checks

```sh
npm run lint
npm run build
```

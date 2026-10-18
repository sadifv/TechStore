# TechStore Frontend

React and Vite frontend for the TechStore application. The existing Express application remains the API server during this migration.

## Local development

Run the backend from the project root in one terminal:

```sh
npm run dev
```

Run the React frontend from this directory in a second terminal:

```sh
npm run dev
```

Open the Vite URL shown in the frontend terminal (normally `http://localhost:5173`). Vite proxies API and form requests to `http://localhost:3001`; both processes must be running for data, authentication, cart, and checkout features to work.

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

## Checks

```sh
npm run lint
npm run build
```

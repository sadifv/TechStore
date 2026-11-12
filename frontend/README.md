# TechStore Frontend

React and Vite frontend for the TechStore application. The existing Express application remains the API server during this migration.

## Local development

Use a current Node.js 22 patch (minimum 22.13.0) or Node.js 24, as declared in `engines`.

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

## API URL and deployment

`VITE_API_BASE_URL` controls where React sends API requests and uploaded-image requests. Leave it empty when a reverse proxy serves the React app and forwards `/api/` and `/uploads/` to Express on the same domain. For separate subdomains on the same site, set it to the API origin (for example, `https://api.tu-dominio.com`) before running `npm run build`; Vite embeds this value in the production bundle. Do not add `/api` to the base URL.

For production, publish `dist/` as the React site and run Express separately. Set backend `APP_URL` and `FRONTEND_URL` to the public React URL, and set `ALLOWED_ORIGINS` to that exact origin. Use HTTPS and keep the frontend and API on the same site so the session cookie works. See the root README for the deployment setup and environment examples.

On Netlify, `NETLIFY_BACKEND_URL` can select the HTTPS Render origin at build time. The build updates API/uploads destinations in `dist/_redirects` and keeps the SPA rule last. This variable is required in Netlify builds; only local builds retain the source redirect destinations when it is unset. This variable does not replace `VITE_API_BASE_URL` or the local Vite proxy.

## Checks

```sh
npm run lint
npm run build
```

## Vercel

Import only this directory with the Vite preset, npm ci, npm run build and dist.
The versioned vercel.json preserves API/uploads proxying to Render, SPA deep links,
legacy image redirects and security headers. Leave VITE_API_BASE_URL unset or empty.
NETLIFY_BACKEND_URL does not configure Vercel. See the [migration guide](../docs/operations/vercel-deployment.md)
for the required Render origin/URL updates and post-deployment verification.

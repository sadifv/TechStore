import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

// Ignore developer .env files, API proxies and remote API configuration entirely.
const server = await createServer({
  configFile: false,
  envDir: false,
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_VERCEL_MEASUREMENTS': JSON.stringify(
      process.env.TEST_VERCEL_MEASUREMENTS === '1',
    ),
  },
  server: {
    host: '127.0.0.1',
    port: 4175,
    strictPort: true,
    headers: { 'Referrer-Policy': 'no-referrer' },
  },
});
await server.listen();

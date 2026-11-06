import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Ignore developer .env files, API proxies and remote API configuration entirely.
const server = await createServer({
  configFile: false,
  envDir: false,
  plugins: [react()],
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 4175, strictPort: true },
});
await server.listen();

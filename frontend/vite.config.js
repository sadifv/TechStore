import react from '@vitejs/plugin-react'
import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.BACKEND_PROXY_TARGET || 'http://localhost:3001'
  const apiProxy = { target: backend, changeOrigin: true }
  const reactPageProxy = {
    target: backend,
    changeOrigin: true,
    bypass(request) {
      if (request.method === 'GET' && request.headers.accept?.includes('text/html')) return '/index.html'
      return undefined
    },
  }

  return {
    plugins: [react()],
    publicDir: 'public',
    server: {
      proxy: {
        '/api/orders/success': reactPageProxy,
        '/api/newsletter/unsubscribe': reactPageProxy,
        '/api/marketing/unsubscribe': reactPageProxy,
        '/api/membership/unsubscribe': reactPageProxy,
        '/error': reactPageProxy,
        '/api': apiProxy,
        '/login': reactPageProxy,
        '/register': reactPageProxy,
        '/profile': reactPageProxy,
        '/vip': reactPageProxy,
        '/legal': reactPageProxy,
        '/forgot-password': reactPageProxy,
        '/reset-password': reactPageProxy,
        '/admin': reactPageProxy,
        '/uploads': apiProxy,
      },
    },
  }
})

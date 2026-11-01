import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/Fourbidden-Routes-namoid/' : '/',
  envDir: '..',
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass: (req) => {
          // Serve SPA index.html for client-side callback route
          if (req.url && req.url.startsWith('/auth/callback')) {
            return '/index.html';
          }
        },
      },
      '/namoid-api': {
        target: 'https://api.namoid.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/namoid-api/, ''),
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('referer');
            proxyReq.removeHeader('origin');
          });
        },
      },
    },
  },
}))

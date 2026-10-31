import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '..',
  server: {
    port: 5173,
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
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The admin console is served from /admin on the single Agiza domain. The
// restaurant API lives at /api/restaurant and the Django marketplace API at
// /api. In development the proxy keeps both contracts identical.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api/restaurant': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/restaurant/, '/api'),
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})

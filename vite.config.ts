import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // The existing Django CORS configuration permits http://localhost:8080.
    port: 8080,
    strictPort: true,
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
})

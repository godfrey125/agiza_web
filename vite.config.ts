import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type Plugin } from 'vite'

const APK_PATH = '/downloads/agiza.apk'
const APK_MIME = 'application/vnd.android.package-archive'

function apkHeaders(): Plugin {
  const setHeaders = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.split('?')[0] === APK_PATH) {
      res.setHeader('Content-Type', APK_MIME)
      res.setHeader('Content-Disposition', 'attachment; filename="agiza.apk"')
    }
    next()
  }

  return {
    name: 'agiza-apk-headers',
    configureServer(server) {
      server.middlewares.use(setHeaders)
    },
    configurePreviewServer(server) {
      server.middlewares.use(setHeaders)
    },
  }
}

export default defineConfig({
  plugins: [react(), apkHeaders()],
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

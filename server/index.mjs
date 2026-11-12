import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { UPLOAD_DIR } from './db.mjs'
import { sendStoredUpload } from './lib/uploads.mjs'
import authRouter from './routes/auth.mjs'
import dashboardRouter from './routes/dashboard.mjs'
import catalogRouter from './routes/catalog.mjs'
import operationsRouter from './routes/operations.mjs'
import growthRouter from './routes/growth.mjs'
import adminRouter from './routes/admin.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT) || 8787
const HOST = process.env.HOST || '127.0.0.1'
const isProduction = process.env.NODE_ENV === 'production'
const isVercel = Boolean(process.env.VERCEL)

// The restaurant API is mounted at /api/restaurant on the single Agiza
// deployment so it never collides with the Django marketplace API at /api.
// Local development keeps the historical /api prefix; the Vite proxy rewrites
// /api/restaurant back to /api.
const API_PREFIX = (process.env.AGIZA_API_PREFIX || '/api').replace(/\/$/, '')

app.disable('x-powered-by')
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json({ limit: '8mb' }))

// Uploaded images are stored in Postgres so they survive serverless cold
// starts. The route is public because menu images are public assets.
// Mount the same app at both the local `/api` prefix and the public
// `/api/restaurant` prefix. Vercel normally strips the public prefix with a
// request.path transform, but accepting both keeps the service correct if the
// transform is unavailable or a request reaches the function directly.
const API_PREFIXES = Array.from(new Set([API_PREFIX, '/api/restaurant']))
  .sort((a, b) => b.length - a.length)

// Legacy local uploads directory (development only).
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: true }))

for (const prefix of API_PREFIXES) {
  app.get(`${prefix}/uploads/:id`, sendStoredUpload)
  app.get(`${prefix}/health`, (req, res) => {
    res.json({ ok: true, service: 'Agiza Admin API', time: new Date().toISOString() })
  })
  app.use(`${prefix}/auth`, authRouter)
  app.use(prefix, dashboardRouter)
  app.use(prefix, catalogRouter)
  app.use(prefix, operationsRouter)
  app.use(prefix, growthRouter)
  app.use(prefix, adminRouter)
  app.use(prefix, (req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' })
  })
}

// Optional static serving for a single-container production run. Vercel serves
// the public site and /admin from their own services, so this stays off there.
if (!isVercel && process.env.SERVE_FRONTEND === 'true') {
  const dist = path.join(__dirname, '..', 'dist')
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h', index: false }))
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
      res.sendFile(path.join(dist, 'index.html'))
    })
  }
}

app.use((error, req, res, next) => {
  console.error(error)
  if (res.headersSent) return next(error)
  const message = isProduction
    ? 'Something went wrong on the server.'
    : (error?.message || 'Unexpected server error.')
  res.status(500).json({ error: message })
})

if (!isVercel) {
  const server = app.listen(PORT, HOST, () => {
    console.log(`Agiza Admin API running at http://${HOST}:${PORT}${API_PREFIX}`)
  })

  function shutdown() {
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

export default app

import { dbGet, dbRun, nowIso } from '../db.mjs'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/**
 * Store an image in Postgres instead of the serverless filesystem. Menu images
 * are small, and this keeps uploads working on Vercel without a service-role
 * Storage key or a writable disk.
 */
export async function saveStoredUpload(dataUrl) {
  const match = String(dataUrl || '').match(
    /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([a-z0-9+/=\s]+)$/i,
  )
  if (!match) return { error: 'Choose a PNG, JPEG, WebP or GIF image.' }

  let mime = match[1].toLowerCase()
  if (mime === 'image/jpg') mime = 'image/jpeg'
  const ext = ALLOWED[mime]
  if (!ext) return { error: 'Choose a PNG, JPEG, WebP or GIF image.' }

  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length) return { error: 'The image is empty.' }
  if (buffer.length > MAX_BYTES) return { error: 'Keep images under 5 MB.' }

  const insert = await dbRun(
    `INSERT INTO uploads (filename, mime_type, byte_size, data, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [`upload-${Date.now()}.${ext}`, mime, buffer.length, buffer, nowIso()],
  )
  return { id: Number(insert.lastInsertRowid), url: `/uploads/${insert.lastInsertRowid}` }
}

export async function sendStoredUpload(req, res) {
  const row = await dbGet('SELECT mime_type, filename, data FROM uploads WHERE id = ?', [req.params.id])
  if (!row) return res.status(404).json({ error: 'Image not found.' })
  res.setHeader('Content-Type', row.mime_type || 'application/octet-stream')
  res.setHeader('Content-Disposition', `inline; filename="${row.filename || 'image'}"`)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  return res.send(row.data)
}

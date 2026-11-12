import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dbAll, dbGet, dbRun, nowIso } from '../db.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DAY = 24 * 60 * 60 * 1000
const SECRET_PATH = process.env.AGIZA_AUTH_SECRET_PATH
  || path.join(os.tmpdir(), 'agiza-admin-auth-secret')

export const ALL_PERMISSIONS = [
  'dashboard.view',
  'menu.view', 'menu.manage',
  'categories.view', 'categories.manage',
  'orders.view', 'orders.manage',
  'customers.view', 'customers.manage',
  'inventory.view', 'inventory.manage',
  'analytics.view',
  'reports.view', 'reports.generate',
  'marketing.view', 'marketing.manage',
  'reviews.view', 'reviews.manage',
  'settings.view', 'settings.general', 'settings.profile', 'settings.staff',
  'settings.roles', 'settings.notifications', 'settings.payments', 'settings.security',
  'audit.view',
]

export function getAuthSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (!fs.existsSync(SECRET_PATH)) {
    fs.mkdirSync(path.dirname(SECRET_PATH), { recursive: true })
    fs.writeFileSync(SECRET_PATH, crypto.randomBytes(48).toString('hex'), { mode: 0o600 })
  }
  return fs.readFileSync(SECRET_PATH, 'utf8').trim()
}

export function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function safeJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  try { return JSON.parse(value) } catch { return fallback }
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, expected] = stored.split(':')
  const actual = crypto.scryptSync(String(password), salt, 64).toString('hex')
  const left = Buffer.from(actual, 'hex')
  const right = Buffer.from(expected, 'hex')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function serializeUser(row) {
  if (!row) return null
  const roleId = row.role_id || row.roleId
  const permissions = safeJson(row.role_permissions || row.permissions, []) || []
  return {
    id: Number(row.user_id || row.id),
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    avatarUrl: row.avatar_url || '',
    status: row.status || 'ACTIVE',
    role: {
      id: roleId,
      name: row.role_name || roleId,
      permissions,
    },
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    createdAt: row.user_created_at || row.created_at,
    lastLogin: row.last_login || null,
  }
}

export async function createSession(userId, req, days = 7) {
  const token = crypto.randomBytes(40).toString('base64url')
  const created = new Date()
  const expires = new Date(created.getTime() + days * DAY)
  await dbRun(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent, revoked) VALUES (?, ?, ?, ?, ?, 0)',
    [tokenHash(token), userId, created.toISOString(), expires.toISOString(), String(req.headers['user-agent'] || '').slice(0, 300)],
  )
  return token
}

export async function revokeUserSessions(userId, exceptToken = null) {
  if (exceptToken) {
    await dbRun('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND token_hash != ?', [userId, tokenHash(exceptToken)])
  } else {
    await dbRun('UPDATE sessions SET revoked = 1 WHERE user_id = ?', [userId])
  }
}

export async function recordLogin(userId, email, req, success = true) {
  await dbRun(
    'INSERT INTO login_history (user_id, email, ip, user_agent, success, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId || null, email, 'local', String(req.headers['user-agent'] || '').slice(0, 300), success ? 1 : 0, nowIso()],
  )
}

export function audit(userId, action, entityType, entityId = '', details = '') {
  return dbRun(
    'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId || null, action, entityType, String(entityId ?? ''), details, nowIso()],
  ).catch((error) => console.error('audit log failed:', error))
}

export function notify(title, message, type = 'INFO') {
  return dbRun(
    'INSERT INTO notifications (title, message, type, read, created_at) VALUES (?, ?, ?, 0, ?)',
    [title, message, type, nowIso()],
  ).catch((error) => console.error('notification failed:', error))
}

export function hasPermission(user, permission) {
  const permissions = user?.role?.permissions || []
  return permissions.includes('*') || permissions.includes(permission)
}

function decodeBase64Url(value) {
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64')
}

/**
 * Verify the HS256 access token issued by Django (SimpleJWT). This lets the
 * single Supabase/Google login drive both the marketplace and restaurant APIs.
 */
export function verifyDjangoJwt(token) {
  const secret = process.env.DJANGO_JWT_SECRET
    || process.env.DJANGO_SECRET_KEY
    || process.env.SECRET_KEY
    || process.env.AUTH_SECRET
  if (!secret) return null
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return null
  const [headerPart, payloadPart, signaturePart] = parts
  let header
  let payload
  try {
    header = JSON.parse(decodeBase64Url(headerPart).toString('utf8'))
    payload = JSON.parse(decodeBase64Url(payloadPart).toString('utf8'))
  } catch {
    return null
  }
  if (header?.alg !== 'HS256') return null
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64url')
  const left = Buffer.from(signaturePart)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null
  if (payload?.token_type && payload.token_type !== 'access') return null
  if (payload?.exp && Number(payload.exp) * 1000 <= Date.now()) return null
  return payload
}

async function restaurantUserForDjangoToken(payload) {
  let email = String(payload?.email || '').trim().toLowerCase()
  if (!email && payload?.user_id) {
    const djangoUser = await dbGet(
      'SELECT email FROM public.users_user WHERE id = ?',
      [payload.user_id],
    )
    email = String(djangoUser?.email || '').trim().toLowerCase()
  }
  if (!email) return null
  const allowedEmail = (process.env.PLATFORM_ADMIN_EMAIL || 'shorahgodfrey12@gmail.com')
    .trim()
    .toLowerCase()
  if (email !== allowedEmail) return null
  return dbGet(
    `SELECT u.id AS user_id, u.name, u.email, u.phone, u.avatar_url, u.status,
            u.two_factor_enabled, u.created_at AS user_created_at, u.last_login,
            r.id AS role_id, r.name AS role_name, r.permissions AS role_permissions
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE lower(u.email) = lower(?)`,
    [email],
  )
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (!token) return res.status(401).json({ error: 'Authentication required.' })

    const jwtPayload = verifyDjangoJwt(token)
    if (jwtPayload) {
      const jwtUser = await restaurantUserForDjangoToken(jwtPayload)
      if (!jwtUser) {
        return res.status(403).json({ error: 'This account is not allowed into the admin console.' })
      }
      if (jwtUser.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'This account is inactive.' })
      }
      req.user = serializeUser(jwtUser)
      req.token = token
      req.authType = 'django'
      return next()
    }

    const row = await dbGet(
      `SELECT s.created_at AS session_created_at, s.expires_at,
              u.id AS user_id, u.name, u.email, u.phone, u.avatar_url, u.status,
              u.two_factor_enabled, u.created_at AS user_created_at, u.last_login,
              r.id AS role_id, r.name AS role_name, r.permissions AS role_permissions
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE s.token_hash = ? AND s.revoked = 0 AND s.expires_at > ?`,
      [tokenHash(token), nowIso()],
    )
    if (!row) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    if (row.status !== 'ACTIVE') return res.status(403).json({ error: 'This account is inactive.' })
    req.user = serializeUser(row)
    req.token = token
    next()
  } catch (error) {
    next(error)
  }
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' })
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' })
    }
    next()
  }
}

export function startOfDay(date = new Date()) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function endOfDay(date = new Date()) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY)
}

export function rangeFromQuery(query = {}) {
  const now = new Date()
  const range = String(query.range || '30d')
  let start
  let end = now
  let label = 'Last 30 days'

  if (query.start || query.end || range === 'custom') {
    start = query.start ? startOfDay(new Date(`${query.start}T00:00:00`)) : addDays(startOfDay(now), -29)
    end = query.end ? endOfDay(new Date(`${query.end}T00:00:00`)) : now
    if (Number.isNaN(start.getTime())) start = addDays(startOfDay(now), -29)
    if (Number.isNaN(end.getTime())) end = now
    label = `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`
  } else if (range === 'today') {
    start = startOfDay(now)
    end = now
    label = 'Today'
  } else if (range === 'yesterday') {
    start = addDays(startOfDay(now), -1)
    end = endOfDay(start)
    label = 'Yesterday'
  } else if (range === '7d') {
    start = addDays(startOfDay(now), -6)
    label = 'Last 7 days'
  } else if (range === '30d') {
    start = addDays(startOfDay(now), -29)
    label = 'Last 30 days'
  } else if (range === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    label = 'This month'
  } else if (range === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))
    label = 'Last month'
  } else if (range === 'this_year') {
    start = new Date(now.getFullYear(), 0, 1)
    label = 'This year'
  } else {
    start = addDays(startOfDay(now), -29)
  }

  const duration = Math.max(DAY, end.getTime() - start.getTime())
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(start.getTime() - duration)
  return {
    range,
    start,
    end,
    prevStart,
    prevEnd,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    prevStartIso: prevStart.toISOString(),
    prevEndIso: prevEnd.toISOString(),
    label,
  }
}

export function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0
  return round(((current - previous) / previous) * 100)
}

export function dateSeries(start, end) {
  const dates = []
  const cursor = startOfDay(start)
  const last = startOfDay(end)
  while (cursor <= last && dates.length < 400) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export function fillSeries(rows, start, end, fields) {
  const map = new Map(rows.map((row) => [row.date, row]))
  return dateSeries(start, end).map((date) => {
    const row = map.get(date) || {}
    const value = { date }
    fields.forEach((field) => { value[field] = Number(row[field] || 0) })
    return value
  })
}

export function pagination(query = {}, defaultSize = 20) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(500, Math.max(1, Number(query.pageSize) || defaultSize))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

export function searchTerm(value) {
  return `%${String(value || '').trim()}%`
}

export function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(headers, rows) {
  return [
    headers.map((header) => csvEscape(header.label)).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header.key])).join(',')),
  ].join('\r\n')
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  let result = ''
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0')
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0')
    result += alphabet[parseInt(chunk, 2)]
  }
  return result
}

export function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = String(input).toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '')
  let bits = ''
  for (const char of clean) {
    const index = alphabet.indexOf(char)
    if (index < 0) continue
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20))
}

export function totpCode(secret, time = Date.now()) {
  const counter = Math.floor(time / 30000)
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))
  const digest = crypto.createHmac('sha1', base32Decode(secret)).update(buffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  return String(binary % 1000000).padStart(6, '0')
}

export function verifyTotp(secret, code) {
  const value = String(code || '').trim()
  if (!/^\d{6}$/.test(value)) return false
  for (const drift of [-1, 0, 1]) {
    if (totpCode(secret, Date.now() + drift * 30000) === value) return true
  }
  return false
}

export function signChallenge(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, expires: Date.now() + 5 * 60 * 1000 })).toString('base64url')
  const signature = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyChallenge(token) {
  try {
    const [payload, signature] = String(token || '').split('.')
    if (!payload || !signature) return null
    const expected = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!data.expires || data.expires < Date.now()) return null
    return data
  } catch {
    return null
  }
}

export function daysBetween(start, end) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY))
}

export function orderAmounts(items, discount = 0, taxRate = 0.05) {
  const subtotal = round(items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0))
  const appliedDiscount = round(Math.min(subtotal, Math.max(0, Number(discount) || 0)))
  const tax = round((subtotal - appliedDiscount) * taxRate)
  return { subtotal, discount: appliedDiscount, tax, total: round(subtotal - appliedDiscount + tax) }
}

export function getReportDateRange(body) {
  const startDate = body.startDate || body.start || addDays(startOfDay(new Date()), -29).toISOString().slice(0, 10)
  const endDate = body.endDate || body.end || new Date().toISOString().slice(0, 10)
  return {
    startDate,
    endDate,
    startIso: startOfDay(new Date(`${startDate}T00:00:00`)).toISOString(),
    endIso: endOfDay(new Date(`${endDate}T00:00:00`)).toISOString(),
  }
}

export { dbAll, dbGet, dbRun, nowIso, DAY }

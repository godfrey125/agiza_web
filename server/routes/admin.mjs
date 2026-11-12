import express from 'express'
import {
  ALL_PERMISSIONS, audit, dbAll, dbGet, dbRun, hashPassword, nowIso,
  requireAuth, requirePermission, revokeUserSessions, safeJson, serializeUser,
  tokenHash, verifyPassword,
} from '../lib/core.mjs'

const router = express.Router()
router.use(requireAuth)

async function settingsMap() {
  const rows = await dbAll('SELECT key, value FROM settings ORDER BY key')
  const settings = {}
  rows.forEach((row) => { settings[row.key] = safeJson(row.value, row.value) })
  return settings
}

async function setSetting(key, value) {
  await dbRun(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)],
  )
}

router.get('/settings', requirePermission('settings.view'), async (req, res) => {
  res.json({ settings: await settingsMap(), permissions: ALL_PERMISSIONS })
})

const allowedSettings = {
  general: ['restaurantName', 'tagline', 'description', 'contact', 'email', 'address', 'businessHours', 'currency', 'timezone'],
  notifications: ['newOrder', 'lowStock', 'payment', 'review', 'dailySummary'],
  payments: ['cash', 'card', 'mobileMoney', 'bankTransfer'],
  security: ['sessionTimeout'],
}

router.put('/settings/:section', async (req, res) => {
  const section = req.params.section
  if (!allowedSettings[section]) return res.status(404).json({ error: 'Settings section not found.' })
  if (section === 'general' && !req.user.role.permissions.includes('*') && !req.user.role.permissions.includes('settings.general')) {
    return res.status(403).json({ error: 'You cannot update general settings.' })
  }
  if (section === 'notifications' && !req.user.role.permissions.includes('*') && !req.user.role.permissions.includes('settings.notifications')) {
    return res.status(403).json({ error: 'You cannot update notification settings.' })
  }
  if (section === 'payments' && !req.user.role.permissions.includes('*') && !req.user.role.permissions.includes('settings.payments')) {
    return res.status(403).json({ error: 'You cannot update payment settings.' })
  }
  if (section === 'security' && !req.user.role.permissions.includes('*') && !req.user.role.permissions.includes('settings.security')) {
    return res.status(403).json({ error: 'You cannot update security settings.' })
  }

  const body = req.body || {}
  if (section === 'general') {
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return res.status(400).json({ error: 'Enter a valid restaurant email address.' })
    }
    if (body.restaurantName !== undefined && !String(body.restaurantName).trim()) {
      return res.status(400).json({ error: 'Restaurant name cannot be empty.' })
    }
  }
  const changes = {}
  allowedSettings[section].forEach((key) => {
    if (body[key] !== undefined) changes[key] = body[key]
  })
  if (!Object.keys(changes).length) return res.status(400).json({ error: 'No settings were provided.' })
  for (const [key, value] of Object.entries(changes)) {
    await setSetting(`${section}.${key}`, value)
  }
  if (section === 'payments') {
    const connected = Boolean(process.env.PAYMENT_PROVIDER_API_KEY)
    await setSetting('payments.providerConnected', connected)
    await setSetting('payments.provider', connected ? (process.env.PAYMENT_PROVIDER_NAME || 'Configured provider') : 'Not connected')
  }
  audit(req.user.id, 'SETTINGS_UPDATED', 'SETTINGS', section, `Updated ${section} settings`)
  res.json({ message: 'Settings saved.', settings: await settingsMap() })
})

router.put('/profile', async (req, res) => {
  const body = req.body || {}
  const name = String(body.name ?? req.user.name).trim()
  const email = String(body.email ?? req.user.email).trim().toLowerCase()
  if (!name) return res.status(400).json({ error: 'Name cannot be empty.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' })
  if (await dbGet('SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?', [email, req.user.id])) {
    return res.status(400).json({ error: 'Another account already uses that email address.' })
  }
  await dbRun('UPDATE users SET name = ?, email = ?, phone = ?, avatar_url = ? WHERE id = ?', [
    name, email, String(body.phone ?? req.user.phone ?? ''), String(body.avatarUrl ?? req.user.avatarUrl ?? ''), req.user.id,
  ])
  audit(req.user.id, 'PROFILE_UPDATED', 'USER', req.user.id, 'Updated their own profile')
  const row = await dbGet(
    `SELECT u.*, u.id AS user_id, u.created_at AS user_created_at, r.name AS role_name, r.permissions AS role_permissions
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    [req.user.id],
  )
  res.json({ message: 'Profile updated.', user: serializeUser(row) })
})

async function activeSuperAdmins(excludeId = 0) {
  return (await dbGet(
    "SELECT COUNT(*) AS count FROM users WHERE role_id = 'super_admin' AND status = 'ACTIVE' AND id != ?",
    [excludeId],
  ))?.count || 0
}

async function staffRows() {
  const rows = await dbAll(
    `SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.status, u.created_at, u.last_login,
            u.two_factor_enabled, r.id AS role_id, r.name AS role_name, r.permissions
     FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.status DESC, u.name ASC`,
  )
  return rows.map((row) => ({
    id: Number(row.id), name: row.name, email: row.email, phone: row.phone,
    avatarUrl: row.avatar_url, status: row.status, createdAt: row.created_at, lastLogin: row.last_login,
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    role: { id: row.role_id, name: row.role_name, permissions: safeJson(row.permissions, []) },
  }))
}

router.get('/staff', requirePermission('settings.staff'), async (req, res) => {
  res.json({ staff: await staffRows() })
})

router.post('/staff', requirePermission('settings.staff'), async (req, res) => {
  const body = req.body || {}
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const roleId = String(body.roleId || '')
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' })
  if (password.length < 8) return res.status(400).json({ error: 'The initial password must be at least 8 characters.' })
  if (!(await dbGet('SELECT id FROM roles WHERE id = ?', [roleId]))) return res.status(400).json({ error: 'Choose a valid role.' })
  if (await dbGet('SELECT id FROM users WHERE lower(email) = lower(?)', [email])) return res.status(400).json({ error: 'An account with this email already exists.' })
  const insert = await dbRun(
    'INSERT INTO users (name, email, phone, password_hash, role_id, avatar_url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, email, String(body.phone || ''), hashPassword(password), roleId, String(body.avatarUrl || ''), 'ACTIVE', nowIso()],
  )
  audit(req.user.id, 'STAFF_CREATED', 'USER', insert.lastInsertRowid, `Added staff member ${name}`)
  res.status(201).json({ id: Number(insert.lastInsertRowid), message: 'Staff member added.' })
})

router.put('/staff/:id', requirePermission('settings.staff'), async (req, res) => {
  const target = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id])
  if (!target) return res.status(404).json({ error: 'Staff member not found.' })
  const body = req.body || {}
  const name = String(body.name ?? target.name).trim()
  const email = String(body.email ?? target.email).trim().toLowerCase()
  const roleId = String(body.roleId ?? target.role_id)
  const status = String(body.status ?? target.status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
  if (!name) return res.status(400).json({ error: 'Name cannot be empty.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' })
  if (!(await dbGet('SELECT id FROM roles WHERE id = ?', [roleId]))) return res.status(400).json({ error: 'Choose a valid role.' })
  if (await dbGet('SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?', [email, target.id])) {
    return res.status(400).json({ error: 'Another account already uses that email address.' })
  }
  if (target.id === req.user.id && (status !== 'ACTIVE' || roleId !== target.role_id)) {
    return res.status(400).json({ error: 'You cannot deactivate yourself or change your own role.' })
  }
  const losingSuperAdmin = target.role_id === 'super_admin' && (roleId !== 'super_admin' || status !== 'ACTIVE')
  if (losingSuperAdmin && (await activeSuperAdmins(target.id)) === 0) {
    return res.status(400).json({ error: 'At least one active Super Admin must remain.' })
  }
  await dbRun(
    'UPDATE users SET name = ?, email = ?, phone = ?, role_id = ?, status = ?, avatar_url = ? WHERE id = ?',
    [name, email, String(body.phone ?? target.phone ?? ''), roleId, status, String(body.avatarUrl ?? target.avatar_url ?? ''), target.id],
  )
  if (status !== 'ACTIVE') await revokeUserSessions(target.id)
  audit(req.user.id, 'STAFF_UPDATED', 'USER', target.id, `Updated staff member ${name} (${roleId}, ${status})`)
  res.json({ message: 'Staff member updated.' })
})

router.delete('/staff/:id', requirePermission('settings.staff'), async (req, res) => {
  const target = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id])
  if (!target) return res.status(404).json({ error: 'Staff member not found.' })
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' })
  if (target.role_id === 'super_admin' && (await activeSuperAdmins(target.id)) === 0) {
    return res.status(400).json({ error: 'At least one active Super Admin must remain.' })
  }
  await dbRun('DELETE FROM users WHERE id = ?', [target.id])
  audit(req.user.id, 'STAFF_DELETED', 'USER', target.id, `Removed staff member ${target.name}`)
  res.json({ message: 'Staff member removed.' })
})

router.get('/roles', requirePermission('settings.roles'), async (req, res) => {
  const rows = await dbAll(
    `SELECT r.*, COUNT(u.id) AS user_count FROM roles r LEFT JOIN users u ON u.role_id = r.id
     GROUP BY r.id ORDER BY CASE WHEN r.id = 'super_admin' THEN 0 WHEN r.id = 'administrator' THEN 1 ELSE 2 END, r.name`,
  )
  res.json({
    roles: rows.map((row) => ({
      id: row.id, name: row.name, description: row.description,
      permissions: safeJson(row.permissions, []), userCount: Number(row.user_count),
      locked: row.id === 'super_admin',
    })),
    permissions: ALL_PERMISSIONS,
  })
})

router.post('/roles', requirePermission('settings.roles'), async (req, res) => {
  const body = req.body || {}
  const name = String(body.name || '').trim()
  const description = String(body.description || '').trim()
  if (!name) return res.status(400).json({ error: 'Role name is required.' })
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)
  if (!id) return res.status(400).json({ error: 'Use a name with letters or numbers.' })
  if (await dbGet('SELECT id FROM roles WHERE id = ?', [id])) return res.status(400).json({ error: 'A role with this name already exists.' })
  const permissions = Array.isArray(body.permissions)
    ? body.permissions.filter((permission) => ALL_PERMISSIONS.includes(permission))
    : []
  await dbRun('INSERT INTO roles (id, name, description, permissions, created_at) VALUES (?, ?, ?, ?, ?)', [
    id, name, description, JSON.stringify(permissions), nowIso(),
  ])
  audit(req.user.id, 'ROLE_CREATED', 'ROLE', id, `Created role ${name}`)
  res.status(201).json({ id, message: 'Role created.' })
})

router.put('/roles/:id', requirePermission('settings.roles'), async (req, res) => {
  const existing = await dbGet('SELECT * FROM roles WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Role not found.' })
  if (existing.id === 'super_admin') return res.status(400).json({ error: 'The Super Admin role always has full access and cannot be edited.' })
  const body = req.body || {}
  const name = String(body.name ?? existing.name).trim()
  if (!name) return res.status(400).json({ error: 'Role name is required.' })
  const permissions = Array.isArray(body.permissions)
    ? [...new Set(body.permissions.filter((permission) => ALL_PERMISSIONS.includes(permission)))]
    : safeJson(existing.permissions, [])
  await dbRun('UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ?', [
    name, String(body.description ?? existing.description), JSON.stringify(permissions), existing.id,
  ])
  audit(req.user.id, 'ROLE_UPDATED', 'ROLE', existing.id, `Updated role ${name} with ${permissions.length} permissions`)
  res.json({ message: 'Role updated.' })
})

router.delete('/roles/:id', requirePermission('settings.roles'), async (req, res) => {
  const existing = await dbGet('SELECT * FROM roles WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Role not found.' })
  if (existing.id === 'super_admin') return res.status(400).json({ error: 'The Super Admin role cannot be deleted.' })
  const count = (await dbGet('SELECT COUNT(*) AS count FROM users WHERE role_id = ?', [existing.id]))?.count || 0
  if (Number(count) > 0) return res.status(409).json({ error: `Move the ${count} staff member${Number(count) === 1 ? '' : 's'} on this role before deleting it.` })
  await dbRun('DELETE FROM roles WHERE id = ?', [existing.id])
  audit(req.user.id, 'ROLE_DELETED', 'ROLE', existing.id, `Deleted role ${existing.name}`)
  res.json({ message: 'Role deleted.' })
})

router.get('/security', async (req, res) => {
  const sessions = await dbAll(
    `SELECT token_hash, created_at, expires_at, user_agent FROM sessions
     WHERE user_id = ? AND revoked = 0 AND expires_at > ? ORDER BY created_at DESC`,
    [req.user.id, nowIso()],
  )
  const history = await dbAll(
    'SELECT id, email, ip, user_agent, success, created_at FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
    [req.user.id],
  )
  const currentHash = tokenHash(req.token)
  res.json({
    twoFactorEnabled: req.user.twoFactorEnabled,
    sessions: sessions.map((row) => ({
      id: row.token_hash.slice(0, 16), tokenHash: row.token_hash, createdAt: row.created_at,
      expiresAt: row.expires_at, userAgent: row.user_agent, current: row.token_hash === currentHash,
    })),
    loginHistory: history.map((row) => ({
      id: row.id, email: row.email, ip: row.ip, userAgent: row.user_agent,
      success: Boolean(row.success), createdAt: row.created_at,
    })),
    sessionPolicy: (await dbGet("SELECT value FROM settings WHERE key = 'security.sessionTimeout'"))?.value || '"12 hours"',
    limitations: [
      'Two-factor authentication uses a TOTP authenticator app. Email and SMS fallback codes are not configured.',
      'Login history records the local network address only. Production deployments should place this service behind a trusted proxy.',
    ],
  })
})

router.delete('/security/sessions/:tokenHash', async (req, res) => {
  const hash = req.params.tokenHash
  const session = await dbGet('SELECT * FROM sessions WHERE token_hash = ?', [hash])
  if (!session) return res.status(404).json({ error: 'Session not found.' })
  const isSuper = req.user.role.permissions.includes('*')
  if (session.user_id !== req.user.id && !isSuper) return res.status(403).json({ error: "You cannot revoke another user's session." })
  await dbRun('UPDATE sessions SET revoked = 1 WHERE token_hash = ?', [hash])
  audit(req.user.id, 'SESSION_REVOKED', 'SESSION', hash.slice(0, 12), 'Revoked an active session')
  res.json({ message: 'Session revoked.' })
})

router.post('/security/sessions/revoke-others', async (req, res) => {
  await revokeUserSessions(req.user.id, req.token)
  audit(req.user.id, 'SESSIONS_REVOKED', 'SESSION', String(req.user.id), 'Revoked all other active sessions')
  res.json({ message: 'All other sessions have been signed out.' })
})

router.put('/security/password', async (req, res) => {
  if (req.authType === 'django') {
    return res.status(400).json({ error: 'Your password is managed by your Agiza account.' })
  }
  const current = String(req.body?.currentPassword || '')
  const next = String(req.body?.newPassword || '')
  if (next.length < 8) return res.status(400).json({ error: 'The new password must be at least 8 characters.' })
  const row = await dbGet('SELECT password_hash FROM users WHERE id = ?', [req.user.id])
  if (!row || !verifyPassword(current, row.password_hash)) return res.status(400).json({ error: 'The current password is incorrect.' })
  await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(next), req.user.id])
  await revokeUserSessions(req.user.id, req.token)
  audit(req.user.id, 'PASSWORD_CHANGED', 'USER', String(req.user.id), 'Changed password from security settings')
  res.json({ message: 'Password updated. Other sessions were signed out.' })
})

export default router

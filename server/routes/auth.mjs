import express from 'express'
import {
  audit, createSession, dbGet, dbRun, generateTotpSecret, hashPassword, nowIso,
  recordLogin, requireAuth, revokeUserSessions, serializeUser, signChallenge,
  tokenHash, verifyChallenge, verifyPassword, verifyTotp,
} from '../lib/core.mjs'

const router = express.Router()
const attempts = new Map()

function loginAllowed(key) {
  const entry = attempts.get(key)
  if (!entry) return true
  if (entry.reset < Date.now()) {
    attempts.delete(key)
    return true
  }
  return entry.count < 6
}

function recordFailure(key) {
  const entry = attempts.get(key)
  if (!entry || entry.reset < Date.now()) {
    attempts.set(key, { count: 1, reset: Date.now() + 10 * 60 * 1000 })
  } else {
    entry.count += 1
  }
}

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' })
  if (!loginAllowed(email)) return res.status(429).json({ error: 'Too many sign-in attempts. Please try again in 10 minutes.' })

  const row = await dbGet(
    `SELECT u.*, r.name AS role_name, r.permissions AS role_permissions
     FROM users u JOIN roles r ON r.id = u.role_id WHERE lower(u.email) = ?`,
    [email],
  )
  if (!row || !verifyPassword(password, row.password_hash)) {
    recordFailure(email)
    await recordLogin(row?.id, email, req, false)
    return res.status(401).json({ error: 'Incorrect email or password.' })
  }
  if (row.status !== 'ACTIVE') {
    recordFailure(email)
    await recordLogin(row.id, email, req, false)
    return res.status(403).json({ error: 'This account has been deactivated. Contact a Super Admin.' })
  }

  if (row.two_factor_enabled) {
    return res.json({ requires2fa: true, challengeToken: signChallenge(row.id) })
  }

  attempts.delete(email)
  const token = await createSession(row.id, req)
  await dbRun('UPDATE users SET last_login = ? WHERE id = ?', [nowIso(), row.id])
  await recordLogin(row.id, email, req, true)
  audit(row.id, 'LOGIN', 'SESSION', String(row.id), 'Signed in to the control center')
  return res.json({
    token,
    user: serializeUser({ ...row, user_id: row.id, user_created_at: row.created_at }),
  })
})

router.post('/verify-2fa', async (req, res) => {
  const challenge = verifyChallenge(req.body?.challengeToken)
  if (!challenge) return res.status(401).json({ error: 'This sign-in challenge has expired. Start again.' })
  const row = await dbGet(
    `SELECT u.*, r.name AS role_name, r.permissions AS role_permissions
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    [challenge.userId],
  )
  if (!row || row.status !== 'ACTIVE') return res.status(403).json({ error: 'This account is unavailable.' })
  if (!verifyTotp(row.totp_secret, req.body?.code)) {
    recordFailure(row.email)
    await recordLogin(row.id, row.email, req, false)
    return res.status(401).json({ error: 'The authenticator code is not valid.' })
  }
  const token = await createSession(row.id, req)
  await dbRun('UPDATE users SET last_login = ? WHERE id = ?', [nowIso(), row.id])
  await recordLogin(row.id, row.email, req, true)
  audit(row.id, 'LOGIN_2FA', 'SESSION', String(row.id), 'Signed in with an authenticator code')
  return res.json({
    token,
    user: serializeUser({ ...row, user_id: row.id, user_created_at: row.created_at }),
  })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

router.post('/logout', requireAuth, async (req, res) => {
  if (req.authType !== 'django') {
    await dbRun('UPDATE sessions SET revoked = 1 WHERE token_hash = ?', [tokenHash(req.token)])
  }
  res.json({ ok: true })
})

router.post('/password', requireAuth, async (req, res) => {
  if (req.authType === 'django') {
    return res.status(400).json({ error: 'Your password is managed by your Agiza account.' })
  }
  const current = String(req.body?.currentPassword || '')
  const next = String(req.body?.newPassword || '')
  if (next.length < 8) return res.status(400).json({ error: 'The new password must be at least 8 characters.' })
  const row = await dbGet('SELECT password_hash FROM users WHERE id = ?', [req.user.id])
  if (!row || !verifyPassword(current, row.password_hash)) {
    return res.status(400).json({ error: 'The current password is incorrect.' })
  }
  await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(next), req.user.id])
  await revokeUserSessions(req.user.id, req.token)
  audit(req.user.id, 'PASSWORD_CHANGED', 'USER', String(req.user.id), 'Changed account password')
  res.json({ ok: true, message: 'Password updated. Other sessions have been signed out.' })
})

router.post('/2fa/setup', requireAuth, async (req, res) => {
  if (req.authType === 'django') {
    return res.status(400).json({ error: 'Two-factor authentication is managed by your Agiza account.' })
  }
  const secret = generateTotpSecret()
  await dbRun('UPDATE users SET totp_secret = ?, two_factor_enabled = 0 WHERE id = ?', [secret, req.user.id])
  const label = encodeURIComponent(`Agiza Admin:${req.user.email}`)
  res.json({
    secret,
    otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=Agiza Admin`,
    message: 'Add the secret to an authenticator app, then enter the six-digit code to enable 2FA.',
  })
})

router.post('/2fa/enable', requireAuth, async (req, res) => {
  if (req.authType === 'django') {
    return res.status(400).json({ error: 'Two-factor authentication is managed by your Agiza account.' })
  }
  const row = await dbGet('SELECT totp_secret FROM users WHERE id = ?', [req.user.id])
  if (!row?.totp_secret) return res.status(400).json({ error: 'Start authenticator setup first.' })
  if (!verifyTotp(row.totp_secret, req.body?.code)) {
    return res.status(400).json({ error: 'That authenticator code is not valid.' })
  }
  await dbRun('UPDATE users SET two_factor_enabled = 1 WHERE id = ?', [req.user.id])
  audit(req.user.id, '2FA_ENABLED', 'USER', String(req.user.id), 'Enabled authenticator-based two-factor authentication')
  res.json({ ok: true, message: 'Two-factor authentication is now enabled.' })
})

router.post('/2fa/disable', requireAuth, async (req, res) => {
  if (req.authType === 'django') {
    return res.status(400).json({ error: 'Two-factor authentication is managed by your Agiza account.' })
  }
  const row = await dbGet('SELECT password_hash, totp_secret, two_factor_enabled FROM users WHERE id = ?', [req.user.id])
  if (!row?.two_factor_enabled) return res.json({ ok: true, message: 'Two-factor authentication is already disabled.' })
  const passwordOk = req.body?.password ? verifyPassword(req.body.password, row.password_hash) : false
  const codeOk = req.body?.code ? verifyTotp(row.totp_secret, req.body.code) : false
  if (!passwordOk && !codeOk) return res.status(400).json({ error: 'Enter your password or a current authenticator code.' })
  await dbRun('UPDATE users SET two_factor_enabled = 0, totp_secret = NULL WHERE id = ?', [req.user.id])
  audit(req.user.id, '2FA_DISABLED', 'USER', String(req.user.id), 'Disabled two-factor authentication')
  res.json({ ok: true, message: 'Two-factor authentication has been disabled.' })
})

export default router

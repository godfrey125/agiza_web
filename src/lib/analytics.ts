import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { siteConfig } from './config'
import { tokenStore } from './api'

const VISITOR_KEY = 'agiza.web.analytics.visitor'
const SESSION_KEY = 'agiza.web.analytics.session'
let memoryVisitor = ''
let memorySession = ''

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function getStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function readOrCreate(kind: 'local' | 'session', key: string, fallback: () => string) {
  const storage = getStorage(kind)
  if (storage) {
    const existing = storage.getItem(key)
    if (existing) return existing
    const next = fallback()
    storage.setItem(key, next)
    return next
  }
  const current = kind === 'local' ? memoryVisitor : memorySession
  if (current) return current
  const next = fallback()
  if (kind === 'local') memoryVisitor = next
  else memorySession = next
  return next
}

function visitorId() {
  return readOrCreate('local', VISITOR_KEY, randomId)
}

function sessionId() {
  return readOrCreate('session', SESSION_KEY, randomId)
}

/**
 * Records anonymous public page views for the staff analytics dashboard.
 * It never stores an IP address and respects Do Not Track.
 */
export function AnalyticsTracker() {
  const location = useLocation()
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/downloads')) {
      return
    }
    const dnt =
      navigator.doNotTrack === '1' ||
      (window as Window & { doNotTrack?: string }).doNotTrack === '1'
    if (dnt) return

    const key = location.key || `${location.pathname}${location.search}`
    if (lastTracked.current === key) return
    lastTracked.current = key

    const referrer = (() => {
      try {
        if (!document.referrer) return ''
        const source = new URL(document.referrer)
        return source.origin === window.location.origin ? '' : document.referrer
      } catch {
        return ''
      }
    })()

    const payload = {
      visit_id: randomId(),
      visitor_id: visitorId(),
      session_id: sessionId(),
      path: location.pathname,
      full_path: `${location.pathname}${location.search}`,
      referrer,
      language: document.documentElement.lang || navigator.language || '',
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
    }
    const access = tokenStore.access
    if (access) headers.Authorization = `Bearer ${access}`

    void fetch(`${siteConfig.apiBaseUrl}/analytics/track/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined)
  }, [location.key, location.pathname, location.search])

  return null
}

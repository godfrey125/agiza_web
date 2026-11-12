import { marketplaceTokenStore } from './marketplace'

// The restaurant workspace is served by the same deployment at
// /api/restaurant. The Django marketplace API stays at /api.
const API_BASE = (import.meta.env.VITE_ADMIN_API_URL || '/api/restaurant').replace(/\/$/, '')
const LEGACY_TOKEN_KEY = 'agiza_analytics_token'

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status = 500, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

/**
 * The admin session is owned by the single Supabase/Google login. Restaurant
 * requests reuse the Django access token stored by the marketplace auth
 * provider, so there is only one token to refresh and one identity to audit.
 */
export function getToken() {
  return marketplaceTokenStore.access || localStorage.getItem(LEGACY_TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(LEGACY_TOKEN_KEY, token)
  else localStorage.removeItem(LEGACY_TOKEN_KEY)
}

export function assetUrl(url?: string | null) {
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  // Uploaded images are stored in Postgres and served by the restaurant API.
  if (url.startsWith('/uploads') && API_BASE) return `${API_BASE}${url}`
  if (url.startsWith('/api/')) return url
  if (url.startsWith('/') && API_BASE) return `${API_BASE}${url}`
  return url
}

export function queryString(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const result = search.toString()
  return result ? `?${result}` : ''
}

/**
 * Pages in the restaurant workspace were written against the historical
 * `/api/...` contract. The consolidated deployment mounts that same API under
 * `/api/restaurant`, so strip the old prefix before appending the new base.
 */
function normalizePath(path: string) {
  if (path === '/api') return ''
  return path.startsWith('/api/') ? path.slice(4) : path
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {})
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(`${API_BASE}${normalizePath(path)}`, { ...options, headers })
  } catch {
    throw new ApiError('Could not reach the Agiza Admin API. Check your connection and try again.', 0)
  }
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '')
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(LEGACY_TOKEN_KEY)
      // The marketplace provider listens for this and refreshes the Django JWT
      // or signs the admin out if the refresh token is no longer valid.
      window.dispatchEvent(new CustomEvent('agiza-admin:unauthorized'))
    }
    const message = typeof payload === 'object' && payload && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : `Request failed with status ${response.status}.`
    throw new ApiError(message, response.status, payload)
  }
  return payload as T
}

export const api = {
  get<T>(path: string) {
    return request<T>(path)
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
  },
  put<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) })
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) })
  },
  delete<T>(path: string) {
    return request<T>(path, { method: 'DELETE' })
  },
  async upload(dataUrl: string) {
    return request<{ url: string; message: string }>('/uploads', {
      method: 'POST',
      body: JSON.stringify({ dataUrl }),
    })
  },
  async download(path: string, fallbackName = 'download') {
    const headers = new Headers()
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    let response: Response
    try {
      response = await fetch(`${API_BASE}${normalizePath(path)}`, { headers })
    } catch {
      throw new ApiError('Could not reach the Agiza Admin API.', 0)
    }
    if (!response.ok) {
      let message = 'Download failed.'
      try {
        const payload = await response.json()
        if (payload?.error) message = payload.error
      } catch { /* ignore */ }
      throw new ApiError(message, response.status)
    }
    const blob = await response.blob()
    const disposition = response.headers.get('content-disposition') || ''
    const match = disposition.match(/filename="?([^";]+)"?/i)
    const filename = match?.[1] || fallbackName
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
  },
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.readAsDataURL(file)
  })
}

export function downloadText(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

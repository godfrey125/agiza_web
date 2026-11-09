import { siteConfig } from './config'

const ACCESS_KEY = 'agiza.web.access'
const REFRESH_KEY = 'agiza.web.refresh'
const USER_KEY = 'agiza.web.user'

export type UserRole = 'customer' | 'vendor' | 'rider' | 'admin'

export interface AuthUser {
  id: number | string
  username: string
  email: string
  phone: string
  role: UserRole
  is_active: boolean
  created_at?: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export class ApiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiNotConfiguredError'
  }
}

function parseError(body: unknown, status: number): string {
  if (typeof body === 'string' && body.trim()) return body
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    const direct = record.detail || record.error || record.message
    if (typeof direct === 'string') return direct
    const first = Object.values(record).find(Boolean)
    if (Array.isArray(first) && first.length) return String(first[0])
    if (typeof first === 'string') return first
  }
  return `Request failed (${status})`
}

async function parseResponse(response: Response) {
  const text = await response.text()
  if (!text) return null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  get user(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as AuthUser
    } catch {
      return null
    }
  },
  save(tokens: AuthTokens, user: AuthUser) {
    localStorage.setItem(ACCESS_KEY, tokens.access)
    localStorage.setItem(REFRESH_KEY, tokens.refresh)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  saveAccess(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  saveUser(user: AuthUser) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  },
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.refresh
  if (!refresh) return null
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${siteConfig.apiBaseUrl}/users/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refresh }),
        })
        if (!response.ok) {
          tokenStore.clear()
          return null
        }
        const data = (await response.json()) as { access?: string; refresh?: string }
        if (!data.access) {
          tokenStore.clear()
          return null
        }
        tokenStore.saveAccess(data.access, data.refresh)
        return data.access
      } catch {
        return null
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  auth?: boolean
  baseUrl?: string
  signal?: AbortSignal
  formData?: FormData
  onUploadProgress?: (percent: number) => void
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    auth = true,
    baseUrl = siteConfig.apiBaseUrl,
    signal,
    formData,
    onUploadProgress,
  } = options

  const run = async (token: string | null) => {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (!formData) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`

    if (formData && onUploadProgress) {
      return uploadWithProgress(`${baseUrl}${path}`, formData, headers, method, onUploadProgress)
    }

    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal,
    })
  }

  let response = await run(auth ? tokenStore.access : null)

  if (response.status === 401 && auth && tokenStore.refresh) {
    const newAccess = await refreshAccessToken()
    if (newAccess) response = await run(newAccess)
  }

  const data = await parseResponse(response)
  if (!response.ok) {
    throw new ApiError(response.status, parseError(data, response.status), data)
  }
  return data as T
}

function uploadWithProgress(
  url: string,
  formData: FormData,
  headers: Record<string, string>,
  method: string,
  onUploadProgress: (percent: number) => void,
) {
  return new Promise<Response>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(method, url)
    Object.entries(headers).forEach(([key, value]) => request.setRequestHeader(key, value))
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onUploadProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    request.onload = () => {
      resolve(
        new Response(request.responseText, {
          status: request.status,
          headers: { 'Content-Type': request.getResponseHeader('content-type') || 'application/json' },
        }),
      )
    }
    request.onerror = () => reject(new Error('Network error while uploading. Please try again.'))
    request.ontimeout = () => reject(new Error('Upload timed out. Please try again.'))
    request.timeout = 120_000
    request.send(formData)
  })
}

/* -------------------------------------------------------------------------- */
/*                                 Auth APIs                                   */
/* -------------------------------------------------------------------------- */

export async function requestOtp(phone: string) {
  return apiRequest<{ message?: string; dev_otp?: string }>('/users/auth/request-otp/', {
    method: 'POST',
    auth: false,
    body: { phone },
  })
}

export async function verifyOtp(phone: string, otp: string) {
  return apiRequest<{ tokens: AuthTokens; user: AuthUser; is_new_user: boolean }>(
    '/users/auth/verify-otp/',
    {
      method: 'POST',
      auth: false,
      body: { phone, otp },
    },
  )
}

export async function fetchMe() {
  return apiRequest<AuthUser>('/users/me/')
}

export function updateMe(patch: Partial<Pick<AuthUser, 'email' | 'phone' | 'username'>>) {
  return apiRequest<AuthUser>('/users/me/', { method: 'PATCH', body: patch })
}

/* -------------------------------------------------------------------------- */
/*                              Existing catalogue                            */
/* -------------------------------------------------------------------------- */

export interface MenuItem {
  id: number
  name: string
  description: string
  price: string
  is_available: boolean
}

export interface Vendor {
  id: number
  username: string
  restaurant_name: string
  description: string
  address: string
  landmark: string
  latitude: string | null
  longitude: string | null
  is_open: boolean
  rating: string
  total_ratings: number
  menu_items: MenuItem[]
}

export function fetchVendors() {
  return apiRequest<Vendor[] | { results: Vendor[] }>('/vendors/', { auth: false })
}

export async function fetchVendor(id: string | number) {
  return apiRequest<Vendor>(`/vendors/${id}/`, { auth: false })
}

/* -------------------------------------------------------------------------- */
/*                       Partner application API contract                     */
/* -------------------------------------------------------------------------- */

function partnerUrl(path: string) {
  if (!siteConfig.partnerApiBaseUrl) {
    throw new ApiNotConfiguredError(
      'The partner verification API is not configured. Set VITE_PARTNER_API_BASE_URL to the deployed backend.',
    )
  }
  return `${siteConfig.partnerApiBaseUrl}${path}`
}

export interface ApplicationRequirement {
  id: number | string
  code: string
  application_type: 'vendor' | 'rider'
  label: string
  label_sw?: string
  description: string
  description_sw?: string
  mandatory: boolean
  allowed_types: string[]
  max_size_mb: number
  applies_to: string[]
  category?: 'business' | 'identity' | 'vehicle' | 'profile' | 'other'
  sort_order: number
}

export async function fetchApplicationRequirements(type: 'vendor' | 'rider') {
  const url = partnerUrl(`/application-requirements/?application_type=${type}`)
  return apiRequest<ApplicationRequirement[] | { results: ApplicationRequirement[] }>(url, {
    auth: true,
    baseUrl: '',
  })
}

export async function getMyApplication(type: 'vendor' | 'rider') {
  return apiRequest<Record<string, unknown> | null>(partnerUrl(`/${type}-applications/me/`), {
    auth: true,
    baseUrl: '',
  })
}

export async function submitApplication(
  type: 'vendor' | 'rider',
  payload: FormData,
  onUploadProgress?: (percent: number) => void,
) {
  return apiRequest<Record<string, unknown>>(partnerUrl(`/${type}-applications/`), {
    method: 'POST',
    auth: true,
    baseUrl: '',
    formData: payload,
    onUploadProgress,
  })
}

export interface AdminApplication {
  id: number | string
  reference?: string
  application_type?: 'vendor' | 'rider'
  applicant?: string
  applicant_name?: string
  status?: string
  submitted_at?: string
  updated_at?: string
  [key: string]: unknown
}

export function listAdminApplications(filters: { type?: string; status?: string } = {}) {
  const params = new URLSearchParams()
  if (filters.type && filters.type !== 'all') params.set('type', filters.type)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  const query = params.toString()
  return apiRequest<AdminApplication[] | { results: AdminApplication[] }>(
    partnerUrl(`/admin/applications/${query ? `?${query}` : ''}`),
    { auth: true, baseUrl: '' },
  )
}

export function decideAdminApplication(
  id: number | string,
  decision: 'approve' | 'reject' | 'request_info' | 'suspend',
  reason: string,
) {
  return apiRequest<Record<string, unknown>>(partnerUrl(`/admin/applications/${id}/decision/`), {
    method: 'POST',
    auth: true,
    baseUrl: '',
    body: { decision, reason },
  })
}

export function submitContact(payload: {
  name: string
  phone: string
  email?: string
  topic: string
  message: string
}) {
  if (!siteConfig.contactEndpoint) {
    throw new ApiNotConfiguredError(
      'No verified contact channel is configured yet. Set VITE_CONTACT_ENDPOINT to a trusted backend endpoint.',
    )
  }
  return apiRequest<{ message?: string }>(siteConfig.contactEndpoint, {
    method: 'POST',
    auth: false,
    baseUrl: '',
    body: payload,
  })
}

/* -------------------------------------------------------------------------- */
/*                          Website analytics dashboard                       */
/* -------------------------------------------------------------------------- */

export interface AnalyticsOverview {
  page_views: number
  page_views_change: number | null
  unique_visitors: number
  unique_visitors_change: number | null
  sessions: number
  sessions_change: number | null
  logged_in_visitors: number
  logged_in_visitors_change: number | null
  new_visitors: number
  returning_visitors: number
  active_now: number
  bot_page_views: number
  staff_page_views: number
  all_time_page_views: number
  all_time_unique_visitors: number
}

export interface AnalyticsDailyPoint {
  date: string
  views: number
  visitors: number
}

export interface AnalyticsPageRow {
  path: string
  views: number
  visitors: number
}

export interface AnalyticsSourceRow {
  source: string
  views: number
  visitors: number
}

export interface AnalyticsDeviceRow {
  device: string
  views: number
  visitors: number
}

export interface AnalyticsBrowserRow {
  browser: string
  views: number
  visitors: number
}

export interface AnalyticsRecentVisit {
  path: string
  visitor: string
  time: string
  device: string
  browser: string
  source: string
}

export interface AnalyticsPlatform {
  total_users: number
  new_users: number
  customers: number
  vendors: number
  riders: number
  admins: number
  total_orders: number
  orders_in_range: number
  pending_orders: number
  order_value_in_range: string
  vendor_profiles: number
  rider_profiles: number
}

export interface AdminDashboardData {
  range_days: number
  generated_at: string
  range: { start: string; end: string }
  overview: AnalyticsOverview
  daily: AnalyticsDailyPoint[]
  top_pages: AnalyticsPageRow[]
  top_sources: AnalyticsSourceRow[]
  devices: AnalyticsDeviceRow[]
  browsers: AnalyticsBrowserRow[]
  recent_visits: AnalyticsRecentVisit[]
  platform: AnalyticsPlatform
}

export function fetchAdminDashboard(days: number) {
  return apiRequest<AdminDashboardData>(`/analytics/dashboard/?days=${days}`)
}

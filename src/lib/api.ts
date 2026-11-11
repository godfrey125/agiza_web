import { siteConfig } from './config'

const ACCESS_KEY = 'agiza.web.access'
const REFRESH_KEY = 'agiza.web.refresh'
const USER_KEY = 'agiza.web.user'

export type UserRole = 'customer' | 'vendor' | 'rider' | 'admin'

export type StaffRole =
  | 'NONE'
  | 'SUPER_ADMIN'
  | 'OPERATIONS_MANAGER'
  | 'VERIFICATION_OFFICER'
  | 'FINANCE_OFFICER'
  | 'CUSTOMER_SUPPORT'
  | 'TRUST_SAFETY_OFFICER'
  | 'CONTENT_MANAGER'

export type AccountState =
  | 'ACTIVE'
  | 'WARNING'
  | 'UNDER_REVIEW'
  | 'TEMPORARILY_SUSPENDED'
  | 'RESTRICTED'
  | 'TERMINATED'
  | 'PENDING_VERIFICATION'
  | 'REJECTED'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface AuthUser {
  id: number | string
  username: string
  email: string
  phone: string
  role: UserRole
  staff_role?: StaffRole
  account_state?: AccountState
  account_state_reason?: string
  suspended_until?: string | null
  restriction_flags?: string[]
  risk_level?: RiskLevel
  login_disabled?: boolean
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
    const headers: Record<string, string> = {
      Accept: 'application/json',
      // ngrok's free tier injects an HTML warning into browser requests unless
      // this header is present. Harmless for any other backend.
      'ngrok-skip-browser-warning': 'true',
    }
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

/* -------------------------------------------------------------------------- */
/*                    Centralized control center and governance               */
/* -------------------------------------------------------------------------- */

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface AccountActionRecord {
  id: number
  target: number
  actor: number | null
  actor_name: string
  action: string
  action_label: string
  violation_category: string
  category_label: string
  reason: string
  evidence: string
  internal_notes: string
  duration_days: number | null
  effective_until: string | null
  previous_state: string
  new_state: string
  restriction_flags: string[]
  created_at: string
}

export interface AdminUser {
  id: number
  name: string
  display_name: string
  username: string
  phone: string
  email: string
  role: string
  staff_role: StaffRole
  account_state: AccountState
  account_state_reason: string
  suspended_until: string | null
  restriction_flags: string[]
  login_disabled: boolean
  risk_level: RiskLevel
  risk_score: number
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  photo_url: string
  date_joined: string
  last_login: string | null
  order_count: number
  lifetime_value: string
  violation_count: number
  last_action_at: string | null
  business_name: string
  vehicle_type: string
  is_suspended: boolean
}

export interface AdminUserDetail extends AdminUser {
  recent_actions: AccountActionRecord[]
  appeals: Array<{
    id: number
    status: string
    message: string
    decision_reason: string
    created_at: string
    reviewed_at: string | null
  }>
  notification_count: number
}

export interface AdminSummary {
  generated_at: string
  account_states: {
    total: number
    active: number
    warning: number
    under_review: number
    temporarily_suspended: number
    restricted: number
    terminated: number
    pending_verification: number
    rejected: number
    login_disabled: number
  }
  roles: {
    customers: number
    vendors: number
    riders: number
    admins: number
  }
  risk: {
    low: number
    medium: number
    high: number
    critical: number
  }
  governance: {
    total_actions: number
    actions_7d: number
    pending_appeals: number
    open_investigations: number
    pending_vendor_profiles: number
    pending_rider_profiles: number
  }
  recent_actions: AccountActionRecord[]
  recent_audit: AdminAuditRecord[]
  permissions: string[]
  staff_role: StaffRole
}

export interface AdminAuditRecord {
  id: number
  actor: number | null
  actor_name: string
  actor_label: string
  action: string
  target_type: string
  target_id: string
  target_label: string
  reason: string
  previous_values: Record<string, unknown>
  new_values: Record<string, unknown>
  request_metadata: Record<string, unknown>
  created_at: string
}

export interface StaffMember {
  id: number
  name: string
  phone: string
  email: string
  role: string
  staff_role: StaffRole
  account_state: AccountState
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  last_login: string | null
  date_joined: string
  action_count: number
}

export interface AdminAppeal {
  id: number
  user: number
  user_name: string
  action: number | null
  action_label: string
  message: string
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
  reviewed_by: number | null
  reviewed_by_name: string
  decision_reason: string
  reviewed_at: string | null
  created_at: string
}

export interface MyPermissions {
  staff_role: StaffRole
  account_state: AccountState
  permissions: string[]
  is_control_center_user: boolean
  restrictable_features: Array<{ key: string; label: string }>
}

export type AccountActionType =
  | 'WARNING'
  | 'SUSPEND'
  | 'TERMINATE'
  | 'RESTRICT'
  | 'DISABLE_LOGIN'
  | 'ENABLE_LOGIN'
  | 'REVOKE_SESSIONS'
  | 'RESTORE'
  | 'REQUEST_VERIFICATION'
  | 'INVESTIGATE'
  | 'NOTE'

export type ViolationCategory =
  | 'FRAUD'
  | 'FAKE_DOCUMENTS'
  | 'ILLEGAL_ACTIVITY'
  | 'FOOD_SAFETY'
  | 'ABUSIVE_BEHAVIOUR'
  | 'PAYMENT_ABUSE'
  | 'ACCOUNT_SECURITY'
  | 'TERMS_VIOLATION'
  | 'SPAM'
  | 'OTHER'

export interface ApplyActionPayload {
  action: AccountActionType
  reason: string
  violation_category: ViolationCategory
  evidence?: string
  internal_notes?: string
  duration_days?: number | null
  features?: string[]
  confirm?: string
}

export function fetchAdminSummary() {
  return apiRequest<AdminSummary>('/admin/summary/')
}

export function fetchAdminUsers(params: {
  q?: string
  role?: string
  state?: string
  staff_role?: string
  risk?: string
  ordering?: string
  page?: number
  page_size?: number
} = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'all') query.set(key, String(value))
  })
  const suffix = query.toString()
  return apiRequest<Paginated<AdminUser>>(`/admin/users/${suffix ? `?${suffix}` : ''}`)
}

export function fetchAdminUser(id: number) {
  return apiRequest<AdminUserDetail>(`/admin/users/${id}/`)
}

export function fetchAdminUserHistory(id: number) {
  return apiRequest<AccountActionRecord[]>(`/admin/users/${id}/history/`)
}

export function applyAdminUserAction(id: number, payload: ApplyActionPayload) {
  return apiRequest<{ action: AccountActionRecord; user: AdminUserDetail }>(
    `/admin/users/${id}/actions/`,
    { method: 'POST', body: payload },
  )
}

export async function downloadAdminUsersCsv() {
  const response = await fetch(`${siteConfig.apiBaseUrl}/admin/users/export/`, {
    headers: tokenStore.access
      ? { Authorization: `Bearer ${tokenStore.access}` }
      : undefined,
  })
  if (!response.ok) {
    throw new ApiError(response.status, 'The user export could not be generated.')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'agiza-users.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

export function fetchAdminStaff() {
  return apiRequest<Paginated<StaffMember>>('/admin/staff/?page_size=100')
}

export function updateStaffRole(id: number, staff_role: StaffRole, reason: string) {
  return apiRequest<StaffMember>(`/admin/staff/${id}/role/`, {
    method: 'POST',
    body: { staff_role, reason },
  })
}

export function fetchAdminAudit(params: {
  q?: string
  action?: string
  target_type?: string
  from?: string
  to?: string
  page?: number
} = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'all') query.set(key, String(value))
  })
  const suffix = query.toString()
  return apiRequest<Paginated<AdminAuditRecord>>(`/admin/audit/${suffix ? `?${suffix}` : ''}`)
}

export function fetchAdminAppeals(status = 'all') {
  const suffix = status && status !== 'all' ? `?status=${status}` : ''
  return apiRequest<Paginated<AdminAppeal>>(`/admin/appeals/${suffix}`)
}

export function decideAdminAppeal(
  id: number,
  status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED',
  decision_reason: string,
) {
  return apiRequest<AdminAppeal>(`/admin/appeals/${id}/decide/`, {
    method: 'POST',
    body: { status, decision_reason },
  })
}

export function fetchMyPermissions() {
  return apiRequest<MyPermissions>('/account/permissions/')
}

export function submitPublicAppeal(phone: string, message: string) {
  return apiRequest<{ message: string }>('/account/appeals/public/', {
    method: 'POST',
    auth: false,
    body: { phone, message },
  })
}

/**
 * Agiza marketplace administration API client.
 *
 * The analytics workspace is the private operations console. This module talks
 * to the Django backend that powers the public Agiza website: partner
 * applications, account governance, trust & safety, the audit trail, staff
 * roles and website visitor analytics.
 *
 * Credentials are kept in a separate storage namespace from the restaurant
 * workspace session so the two logins never overwrite each other.
 */

const API_URL = (
  import.meta.env.VITE_AGIZA_API_URL
  || (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api')
).replace(/\/$/, '')

export const marketplaceConfig = {
  apiUrl: API_URL,
  adminEmail: (import.meta.env.VITE_AGIZA_ADMIN_EMAIL || 'shorahgodfrey12@gmail.com')
    .trim()
    .toLowerCase(),
}

const ACCESS_KEY = 'agiza.marketplace.access'
const REFRESH_KEY = 'agiza.marketplace.refresh'
const USER_KEY = 'agiza.marketplace.user'

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

export class MarketplaceApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'MarketplaceApiError'
    this.status = status
    this.data = data
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

export const marketplaceTokenStore = {
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
  const refresh = marketplaceTokenStore.refresh
  if (!refresh) return null
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_URL}/users/auth/token/refresh/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ refresh }),
        })
        if (!response.ok) {
          marketplaceTokenStore.clear()
          return null
        }
        const data = (await response.json()) as { access?: string; refresh?: string }
        if (!data.access) {
          marketplaceTokenStore.clear()
          return null
        }
        marketplaceTokenStore.saveAccess(data.access, data.refresh)
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
  signal?: AbortSignal
}

export async function marketplaceRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options

  const run = async (token: string | null) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    }
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  }

  let response = await run(auth ? marketplaceTokenStore.access : null)

  if (response.status === 401 && auth && marketplaceTokenStore.refresh) {
    const newAccess = await refreshAccessToken()
    if (newAccess) response = await run(newAccess)
  }

  const data = await parseResponse(response)
  if (!response.ok) {
    throw new MarketplaceApiError(response.status, parseError(data, response.status), data)
  }
  return data as T
}

/* -------------------------------------------------------------------------- */
/*                                  Auth                                      */
/* -------------------------------------------------------------------------- */

export function marketplaceFetchMe() {
  return marketplaceRequest<AuthUser>('/users/me/')
}

export function isMarketplaceAdmin(user: AuthUser | null | undefined) {
  if (!user) return false
  const email = (user.email || '').trim().toLowerCase()
  const role = String(user.role || '').toLowerCase()
  return role === 'admin' && email === marketplaceConfig.adminEmail
}

/* -------------------------------------------------------------------------- */
/*                            Partner applications                            */
/* -------------------------------------------------------------------------- */

export interface ApplicationAttachment {
  id: number | string
  code: string
  label: string
  kind: 'document' | 'image'
  url: string
  created_at?: string
}

export interface AdminApplication {
  id: number | string
  reference?: string
  application_type?: 'vendor' | 'rider'
  applicant?: number | string | null
  applicant_name?: string
  applicant_phone?: string
  applicant_email?: string
  status?: string
  submitted_at?: string
  updated_at?: string
  decision_reason?: string
  requested_information?: string
  internal_notes?: string
  decided_at?: string | null
  reviewer_name?: string | null
  payload?: Record<string, unknown>
  attachments?: ApplicationAttachment[]
  [key: string]: unknown
}

export function listAdminApplications(filters: { type?: string; status?: string } = {}) {
  const params = new URLSearchParams()
  if (filters.type && filters.type !== 'all') params.set('type', filters.type)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  const query = params.toString()
  return marketplaceRequest<AdminApplication[] | { results: AdminApplication[] }>(
    `/partner/admin/applications/${query ? `?${query}` : ''}`,
  )
}

export function decideAdminApplication(
  id: number | string,
  decision: 'approve' | 'reject' | 'request_info' | 'suspend',
  reason: string,
) {
  return marketplaceRequest<Record<string, unknown>>(
    `/partner/admin/applications/${id}/decision/`,
    { method: 'POST', body: { decision, reason } },
  )
}

/* -------------------------------------------------------------------------- */
/*                       Visitor analytics and summary                        */
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
  return marketplaceRequest<AdminDashboardData>(`/analytics/dashboard/?days=${days}`)
}

/* -------------------------------------------------------------------------- */
/*                       Governance and account control                       */
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
  return marketplaceRequest<AdminSummary>('/admin/summary/')
}

export function fetchAdminUsers(
  params: {
    q?: string
    role?: string
    state?: string
    staff_role?: string
    risk?: string
    ordering?: string
    page?: number
    page_size?: number
  } = {},
) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'all') query.set(key, String(value))
  })
  const suffix = query.toString()
  return marketplaceRequest<Paginated<AdminUser>>(`/admin/users/${suffix ? `?${suffix}` : ''}`)
}

export function fetchAdminUser(id: number) {
  return marketplaceRequest<AdminUserDetail>(`/admin/users/${id}/`)
}

export function fetchAdminUserHistory(id: number) {
  return marketplaceRequest<AccountActionRecord[]>(`/admin/users/${id}/history/`)
}

export function applyAdminUserAction(id: number, payload: ApplyActionPayload) {
  return marketplaceRequest<{ action: AccountActionRecord; user: AdminUserDetail }>(
    `/admin/users/${id}/actions/`,
    { method: 'POST', body: payload },
  )
}

export async function downloadAdminUsersCsv() {
  const request = (token: string | null) =>
    fetch(`${API_URL}/admin/users/export/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })

  let response = await request(marketplaceTokenStore.access)
  if (response.status === 401 && marketplaceTokenStore.refresh) {
    const newAccess = await refreshAccessToken()
    if (newAccess) response = await request(newAccess)
  }
  if (!response.ok) {
    throw new MarketplaceApiError(response.status, 'The user export could not be generated.')
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
  return marketplaceRequest<Paginated<StaffMember>>('/admin/staff/?page_size=100')
}

export function updateStaffRole(id: number, staff_role: StaffRole, reason: string) {
  return marketplaceRequest<StaffMember>(`/admin/staff/${id}/role/`, {
    method: 'POST',
    body: { staff_role, reason },
  })
}

export function fetchAdminAudit(
  params: {
    q?: string
    action?: string
    target_type?: string
    from?: string
    to?: string
    page?: number
  } = {},
) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'all') query.set(key, String(value))
  })
  const suffix = query.toString()
  return marketplaceRequest<Paginated<AdminAuditRecord>>(`/admin/audit/${suffix ? `?${suffix}` : ''}`)
}

export function fetchAdminAppeals(status = 'all') {
  const suffix = status && status !== 'all' ? `?status=${status}` : ''
  return marketplaceRequest<Paginated<AdminAppeal>>(`/admin/appeals/${suffix}`)
}

export function decideAdminAppeal(
  id: number,
  status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED',
  decision_reason: string,
) {
  return marketplaceRequest<AdminAppeal>(`/admin/appeals/${id}/decide/`, {
    method: 'POST',
    body: { status, decision_reason },
  })
}

export function fetchMyPermissions() {
  return marketplaceRequest<MyPermissions>('/account/permissions/')
}

/* -------------------------------------------------------------------------- */
/*                    Live platform operations (super admin)                  */
/* -------------------------------------------------------------------------- */

export interface PlatformOrder {
  id: number
  code: string
  order_type: string
  order_type_label: string
  fulfillment_method: string
  status: string
  status_label: string
  customer: number
  customer_name: string
  customer_phone: string
  vendor: number
  vendor_name: string
  rider_name: string
  rider_phone: string
  item_count: number
  subtotal: string
  discount_total: string
  delivery_fee: string
  rider_tip: string
  total: string
  payment_method: string
  payment_status: string
  payment_status_label: string
  created_at: string
  accepted_at: string | null
  ready_at: string | null
  finished_at: string | null
}

export interface PlatformOrderItem {
  id: number
  menu_item_ref: number | null
  name: string
  description: string
  image_url: string
  unit_price: string
  quantity: number
  discount: string
  line_total: string
  instructions: string
}

export interface PlatformOrderHistory {
  from_status: string
  to_status: string
  actor_role: string
  note: string
  created_at: string
}

export interface PlatformDelivery {
  id: number
  order: number
  order_code: string
  status: string
  status_label: string
  rider: number | null
  rider_name: string
  rider_phone: string
  pickup_name: string
  pickup_address: string
  dropoff_address: string
  dropoff_landmark: string
  distance_km: string | null
  delivery_fee: string
  rider_tip: string
  rider_earning: string
  assigned_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  created_at: string
}

export interface PlatformOrderDetail extends PlatformOrder {
  items: PlatformOrderItem[]
  history: PlatformOrderHistory[]
  delivery: PlatformDelivery | null
  customer_email: string
  vendor_phone: string
  vendor_address: string
  delivery_address: string
  delivery_landmark: string
  customer_instructions: string
  is_free_delivery: boolean
  estimated_ready_minutes: number | null
  updated_at: string
}

export interface PlatformRider {
  id: number
  name: string
  phone: string
  email: string
  account_state: string
  vehicle_type: string
  vehicle_label: string
  license_plate: string
  is_approved: boolean
  is_online: boolean
  rating_avg: string
  total_deliveries: number
  active_jobs: number
  completed_jobs: number
  earnings: string
  last_latitude: string | null
  last_longitude: string | null
  last_location_at: string | null
  created_at: string
}

export interface PlatformVendor {
  id: number
  business_name: string
  business_type: string
  business_type_label: string
  owner: number
  owner_name: string
  owner_phone: string
  owner_email: string
  phone: string
  address: string
  landmark: string
  is_approved: boolean
  is_online: boolean
  rating_avg: string
  rating_count: number
  min_order_amount: string
  order_count: number
  revenue: string
  menu_item_count: number
  profile_image_url: string
  created_at: string
}

export interface PlatformMenuItem {
  id: number
  name: string
  description: string
  vendor: number
  vendor_name: string
  category: number | null
  category_name: string
  price: string
  image_url: string
  availability_status: string
  availability_label: string
  portions_available: number | null
  preparation_minutes: number
  is_archived: boolean
  order_count: number
  quantity_sold: number
  revenue: string
  created_at: string
  updated_at: string
}

export interface PlatformReview {
  id: number
  order: number
  order_code: string
  vendor: number
  vendor_name: string
  customer: number
  customer_name: string
  rating: number
  comment: string
  created_at: string
}

export interface PlatformPayment {
  id: number
  order: number
  order_code: string
  payer: number
  payer_name: string
  payer_phone: string
  method: string
  method_label: string
  amount: string
  status: string
  status_label: string
  provider_reference: string
  confirmed_by: number | null
  created_at: string
  updated_at: string
}

export interface PlatformOverview {
  generated_at: string
  range_days: number
  orders: {
    total: number
    today: number
    in_range: number
    pending: number
    in_progress: number
    delivered: number
    cancelled: number
    gmv_today: string
    gmv_in_range: string
    avg_order_value: string
    completion_rate: number
  }
  riders: {
    total: number
    approved: number
    online: number
    active_jobs: number
    deliveries_today: number
    earnings_today: string
  }
  vendors: {
    total: number
    approved: number
    online: number
    pending: number
  }
  users: {
    total: number
    customers: number
    vendors: number
    riders: number
    admins: number
    new_today: number
  }
  food: {
    menu_items: number
    available: number
    sold_out: number
    hidden: number
    archived: number
    reviews: number
    average_rating: number
  }
  payments: {
    total: number
    in_range: number
    paid: number
    pending: number
    failed: number
    refunded: number
    unpaid: number
    paid_amount: string
    pending_amount: string
    failed_amount: string
    refunded_amount: string
    unpaid_amount: string
  }
  daily: Array<{ date: string; orders: number; gmv: number }>
  status_breakdown: Array<{ status: string; label: string; count: number }>
  recent_orders: PlatformOrder[]
  top_vendors: Array<{ id: number; name: string; orders: number; revenue: string }>
  top_items: Array<{ name: string; vendor: string; quantity: number; revenue: string; orders: number }>
  top_riders: Array<{ id: number; name: string; deliveries: number; earnings: string }>
}

export interface PlatformListParams {
  q?: string
  status?: string
  order_type?: string
  payment_status?: string
  vendor?: string | number
  rider?: string | number
  online?: string
  approved?: string
  availability?: string
  archived?: string
  rating?: string
  method?: string
  from?: string
  to?: string
  ordering?: string
  page?: number
  page_size?: number
}

function platformQuery(params: PlatformListParams) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      query.set(key, String(value))
    }
  })
  const suffix = query.toString()
  return suffix ? `?${suffix}` : ''
}

export function fetchPlatformOverview(days = 14) {
  return marketplaceRequest<PlatformOverview>(`/admin/platform/overview/?days=${days}`)
}

export function fetchPlatformOrders(params: PlatformListParams = {}) {
  return marketplaceRequest<Paginated<PlatformOrder>>(
    `/admin/platform/orders/${platformQuery(params)}`,
  )
}

export function fetchPlatformOrder(id: number) {
  return marketplaceRequest<PlatformOrderDetail>(`/admin/platform/orders/${id}/`)
}

export function fetchPlatformRiders(params: PlatformListParams = {}) {
  return marketplaceRequest<Paginated<PlatformRider>>(
    `/admin/platform/riders/${platformQuery(params)}`,
  )
}

export function fetchPlatformDeliveries(params: PlatformListParams = {}) {
  return marketplaceRequest<Paginated<PlatformDelivery>>(
    `/admin/platform/deliveries/${platformQuery(params)}`,
  )
}

export function fetchPlatformVendors(params: PlatformListParams = {}) {
  return marketplaceRequest<Paginated<PlatformVendor>>(
    `/admin/platform/vendors/${platformQuery(params)}`,
  )
}

export function fetchPlatformMenuItems(params: PlatformListParams = {}) {
  return marketplaceRequest<Paginated<PlatformMenuItem>>(
    `/admin/platform/menu-items/${platformQuery(params)}`,
  )
}

export function fetchPlatformReviews(params: PlatformListParams = {}) {
  return marketplaceRequest<Paginated<PlatformReview>>(
    `/admin/platform/reviews/${platformQuery(params)}`,
  )
}

export function fetchPlatformPayments(params: PlatformListParams = {}) {
  return marketplaceRequest<Paginated<PlatformPayment>>(
    `/admin/platform/payments/${platformQuery(params)}`,
  )
}

/** Exchange a Supabase (Google) access token for an Agiza JWT pair. */
export function marketplaceSupabaseExchange(accessToken: string) {
  return marketplaceRequest<{ tokens: AuthTokens; user: AuthUser }>('/users/auth/supabase/', {
    method: 'POST',
    auth: false,
    body: { access_token: accessToken },
  })
}

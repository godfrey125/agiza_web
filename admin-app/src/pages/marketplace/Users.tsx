import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Gavel,
  History,
  RefreshCw,
  ShieldAlert,
  UserRound,
} from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  SectionCard,
  Select,
  Textarea,
} from '../../components/ui'
import { cn, formatDateTime, number } from '../../lib/format'
import {
  applyAdminUserAction,
  downloadAdminUsersCsv,
  fetchAdminUser,
  fetchAdminUsers,
  fetchMyPermissions,
  MarketplaceApiError,
  type AccountActionRecord,
  type AccountActionType,
  type AccountState,
  type AdminUser,
  type AdminUserDetail,
  type ApplyActionPayload,
  type RiskLevel,
  type StaffRole,
  type ViolationCategory,
} from '../../lib/marketplace'

const PAGE_SIZE = 20

const STATE_LABELS: Record<AccountState, string> = {
  ACTIVE: 'Active',
  WARNING: 'Warning',
  UNDER_REVIEW: 'Under review',
  TEMPORARILY_SUSPENDED: 'Suspended',
  RESTRICTED: 'Restricted',
  TERMINATED: 'Terminated',
  PENDING_VERIFICATION: 'Pending verification',
  REJECTED: 'Rejected',
}

const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  NONE: 'No staff role',
  SUPER_ADMIN: 'Super admin',
  OPERATIONS_MANAGER: 'Operations manager',
  VERIFICATION_OFFICER: 'Verification officer',
  FINANCE_OFFICER: 'Finance officer',
  CUSTOMER_SUPPORT: 'Customer support',
  TRUST_SAFETY_OFFICER: 'Trust & safety officer',
  CONTENT_MANAGER: 'Content manager',
}

const ACTION_LABELS: Record<AccountActionType, string> = {
  WARNING: 'Issue warning',
  SUSPEND: 'Temporarily suspend',
  TERMINATE: 'Permanently terminate',
  RESTRICT: 'Restrict features',
  DISABLE_LOGIN: 'Disable sign-in',
  ENABLE_LOGIN: 'Enable sign-in',
  REVOKE_SESSIONS: 'Revoke sessions',
  RESTORE: 'Restore account',
  REQUEST_VERIFICATION: 'Request verification',
  INVESTIGATE: 'Open investigation',
  NOTE: 'Internal note',
}

const CATEGORY_LABELS: Record<ViolationCategory, string> = {
  FRAUD: 'Fraud or financial abuse',
  FAKE_DOCUMENTS: 'Fake or altered documents',
  ILLEGAL_ACTIVITY: 'Illegal activity',
  FOOD_SAFETY: 'Food safety or hygiene',
  ABUSIVE_BEHAVIOUR: 'Abusive behaviour',
  PAYMENT_ABUSE: 'Payment or refund abuse',
  ACCOUNT_SECURITY: 'Account security',
  TERMS_VIOLATION: 'Terms of service violation',
  SPAM: 'Spam or misleading content',
  OTHER: 'Other',
}

const ACTION_PERMISSIONS: Record<AccountActionType, string> = {
  WARNING: 'users.warn',
  SUSPEND: 'users.suspend',
  TERMINATE: 'users.terminate',
  RESTRICT: 'users.restrict',
  DISABLE_LOGIN: 'users.disable_login',
  ENABLE_LOGIN: 'users.disable_login',
  REVOKE_SESSIONS: 'users.revoke_sessions',
  RESTORE: 'users.restore',
  REQUEST_VERIFICATION: 'users.request_verification',
  INVESTIGATE: 'users.investigate',
  NOTE: 'users.investigate',
}

const FEATURES = [
  'ordering',
  'delivery',
  'vendor_payouts',
  'rider_jobs',
  'chat',
  'reviews',
  'new_applications',
  'payouts',
]

function stateTone(state: AccountState) {
  if (state === 'ACTIVE') return 'badge-green'
  if (state === 'WARNING' || state === 'RESTRICTED') return 'badge-yellow'
  if (state === 'UNDER_REVIEW' || state === 'PENDING_VERIFICATION') return 'badge-orange'
  return 'badge-red'
}

function riskTone(risk: RiskLevel) {
  if (risk === 'LOW') return 'badge-gray'
  if (risk === 'MEDIUM') return 'badge-yellow'
  if (risk === 'HIGH') return 'badge-orange'
  return 'badge-red'
}

function formatTZS(value: string | number) {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function MarketplaceUsers() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [role, setRole] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [risk, setRisk] = useState('all')
  const [ordering, setOrdering] = useState('-date_joined')
  const [page, setPage] = useState(1)

  const [users, setUsers] = useState<AdminUser[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const [permissions, setPermissions] = useState<string[]>([])
  const [permissionError, setPermissionError] = useState('')

  const [action, setAction] = useState<AccountActionType>('WARNING')
  const [category, setCategory] = useState<ViolationCategory>('TERMS_VIOLATION')
  const [reason, setReason] = useState('')
  const [evidence, setEvidence] = useState('')
  const [notes, setNotes] = useState('')
  const [duration, setDuration] = useState('7')
  const [features, setFeatures] = useState<string[]>([])
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(search.trim()), 350)
    return () => window.clearTimeout(handle)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debounced, role, stateFilter, risk, ordering])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetchAdminUsers({
        q: debounced,
        role,
        state: stateFilter,
        risk,
        ordering,
        page,
        page_size: PAGE_SIZE,
      })
      setUsers(response.results)
      setCount(response.count)
    } catch (cause) {
      setLoadError(
        cause instanceof MarketplaceApiError ? cause.message : 'The account directory could not be loaded.',
      )
    } finally {
      setLoading(false)
    }
  }, [debounced, ordering, page, risk, role, stateFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const response = await fetchMyPermissions()
        if (active) setPermissions(response.permissions)
      } catch {
        if (active) setPermissionError('Your role permissions could not be loaded.')
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const can = useCallback(
    (permission: string) => permissions.includes('*') || permissions.includes(permission),
    [permissions],
  )

  const allowedActions = useMemo(
    () => (Object.keys(ACTION_PERMISSIONS) as AccountActionType[]).filter((key) => can(ACTION_PERMISSIONS[key])),
    [can],
  )

  useEffect(() => {
    if (allowedActions.length && !allowedActions.includes(action)) setAction(allowedActions[0])
  }, [action, allowedActions])

  const selectUser = useCallback(async (id: number) => {
    setSelectedId(id)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    setActionError('')
    setActionSuccess('')
    setReason('')
    setEvidence('')
    setNotes('')
    setConfirm('')
    setFeatures([])
    try {
      setDetail(await fetchAdminUser(id))
    } catch (cause) {
      setDetailError(
        cause instanceof MarketplaceApiError ? cause.message : 'The account could not be loaded.',
      )
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const applyAction = async () => {
    if (!detail) return
    setActionError('')
    setActionSuccess('')
    if (action !== 'REVOKE_SESSIONS' && reason.trim().length < 5) {
      setActionError('Enter a written reason of at least 5 characters.')
      return
    }
    if (action === 'TERMINATE') {
      if (reason.trim().length < 10) {
        setActionError('Permanent termination requires a detailed reason of at least 10 characters.')
        return
      }
      if (evidence.trim().length < 5) {
        setActionError('Supporting evidence is required for permanent termination.')
        return
      }
      if (confirm.trim().toUpperCase() !== 'TERMINATE') {
        setActionError('Type TERMINATE exactly to confirm.')
        return
      }
    }
    if (action === 'SUSPEND') {
      const days = Number(duration)
      if (!Number.isFinite(days) || days < 1 || days > 365) {
        setActionError('Enter a suspension duration between 1 and 365 days.')
        return
      }
    }
    if (action === 'RESTRICT' && features.length === 0) {
      setActionError('Select at least one feature to restrict.')
      return
    }

    const payload: ApplyActionPayload = {
      action,
      reason: reason.trim(),
      violation_category: category,
      evidence: evidence.trim(),
      internal_notes: notes.trim(),
      confirm: confirm.trim(),
    }
    if (action === 'SUSPEND') payload.duration_days = Number(duration)
    if (action === 'RESTRICT') payload.features = features

    setSaving(true)
    try {
      await applyAdminUserAction(detail.id, payload)
      setDetail(await fetchAdminUser(detail.id))
      setActionSuccess('Action recorded and written to the audit log.')
      setReason('')
      setEvidence('')
      setNotes('')
      setConfirm('')
      setFeatures([])
      await load()
    } catch (cause) {
      setActionError(cause instanceof MarketplaceApiError ? cause.message : 'The action could not be applied.')
    } finally {
      setSaving(false)
    }
  }

  const exportUsers = async () => {
    setExportError('')
    try {
      await downloadAdminUsersCsv()
    } catch {
      setExportError('The CSV export could not be generated.')
    }
  }

  const closeDetail = () => {
    setSelectedId(null)
    setDetail(null)
    setDetailError('')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Marketplace"
        title="Account governance"
        description="Search customers, vendors, riders and staff. Apply warnings, suspensions, restrictions or termination with a reason and a permanent audit record."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
              <RefreshCw size={13} />
              Refresh
            </Button>
            {can('users.export') ? (
              <Button variant="secondary" size="sm" onClick={() => void exportUsers()}>
                <Download size={13} />
                Export CSV
              </Button>
            ) : null}
          </>
        }
      />

      {exportError ? (
        <p className="rounded-xl border border-[#f4d7d2] bg-soft-red px-4 py-3 text-xs text-coral">
          {exportError}
        </p>
      ) : null}
      {permissionError ? (
        <p className="rounded-xl border border-[#f4d7d2] bg-soft-red px-4 py-3 text-xs text-coral">
          {permissionError}
        </p>
      ) : null}

      <SectionCard title="Filters" description="Narrow the directory by account type, state, risk or recency.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="sm:col-span-2 xl:col-span-1">
            <Field label="Search">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Name, phone, email or business"
                className="w-full"
              />
            </Field>
          </div>
          <Field label="Account type">
            <Select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="all">All</option>
              <option value="customer">Customers</option>
              <option value="vendor">Vendors</option>
              <option value="rider">Riders</option>
              <option value="admin">Admins</option>
            </Select>
          </Field>
          <Field label="Account state">
            <Select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
              <option value="all">All</option>
              {Object.entries(STATE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Risk level">
            <Select value={risk} onChange={(event) => setRisk(event.target.value)}>
              <option value="all">All</option>
              {Object.entries(RISK_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Order by">
            <Select value={ordering} onChange={(event) => setOrdering(event.target.value)}>
              <option value="-date_joined">Newest accounts</option>
              <option value="date_joined">Oldest accounts</option>
              <option value="-last_login">Recent sign-ins</option>
              <option value="-violation_count">Most violations</option>
              <option value="-risk_score">Highest risk</option>
              <option value="-order_count">Most orders</option>
            </Select>
          </Field>
        </div>
      </SectionCard>

      {loadError ? <ErrorState message={loadError} onRetry={() => void load()} /> : null}

      <SectionCard
        title={`${number(count)} accounts`}
        description="Select an account to review its profile, history and governance actions."
        bodyClassName="p-0"
      >
        {loading ? (
          <div className="p-5">
            <LoadingBlock rows={6} />
          </div>
        ) : users.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<UserRound size={22} />}
              title="No accounts match these filters"
              message="Change the filters or search term and try again."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Type</th>
                    <th>State</th>
                    <th>Risk</th>
                    <th className="text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <p className="table-primary">{user.name}</p>
                        <p className="table-secondary">
                          {user.phone || user.email || user.username}
                          {user.business_name ? ` · ${user.business_name}` : ''}
                        </p>
                      </td>
                      <td>
                        <Badge className={user.role === 'ADMIN' ? 'badge-orange' : 'badge-gray'}>
                          {String(user.role).toLowerCase()}
                        </Badge>
                        {user.staff_role !== 'NONE' ? (
                          <p className="mt-1 text-[10px] text-muted">{STAFF_ROLE_LABELS[user.staff_role]}</p>
                        ) : null}
                      </td>
                      <td>
                        <Badge className={stateTone(user.account_state)}>
                          {STATE_LABELS[user.account_state] || user.account_state}
                        </Badge>
                      </td>
                      <td>
                        <Badge className={riskTone(user.risk_level)}>{RISK_LABELS[user.risk_level]}</Badge>
                      </td>
                      <td className="text-right">
                        <Button variant="secondary" size="sm" onClick={() => void selectUser(user.id)}>
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count} onChange={setPage} />
          </>
        )}
      </SectionCard>

      <Modal
        open={selectedId !== null}
        onClose={closeDetail}
        title={detail?.name || 'Account review'}
        description={
          detail
            ? `${detail.phone || detail.email || detail.username} · #${detail.id} · ${STATE_LABELS[detail.account_state]}`
            : undefined
        }
        width="max-w-3xl"
      >
        {detailLoading ? (
          <LoadingBlock rows={6} />
        ) : detailError ? (
          <ErrorState message={detailError} onRetry={() => selectedId && void selectUser(selectedId)} />
        ) : detail ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-[#fdfbf7] p-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Orders</p>
                <p className="mt-1 text-sm font-bold text-ink">{number(detail.order_count)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Paid value</p>
                <p className="mt-1 text-sm font-bold text-ink">{formatTZS(detail.lifetime_value)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Violations</p>
                <p className="mt-1 text-sm font-bold text-ink">{number(detail.violation_count)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Risk score</p>
                <p className="mt-1 text-sm font-bold text-ink">
                  {detail.risk_score} · {RISK_LABELS[detail.risk_level]}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Joined</p>
                <p className="mt-1 text-xs font-semibold text-ink">{formatDateTime(detail.date_joined)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Last sign-in</p>
                <p className="mt-1 text-xs font-semibold text-ink">{formatDateTime(detail.last_login)}</p>
              </div>
            </div>

            {detail.account_state_reason ? (
              <div className="rounded-xl border border-line p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Recorded reason</p>
                <p className="mt-1 text-xs leading-5 text-ink">{detail.account_state_reason}</p>
                {detail.suspended_until ? (
                  <p className="mt-1 text-xs font-semibold text-[#9A7214]">
                    Suspended until {formatDateTime(detail.suspended_until)}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                Restricted features
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.restriction_flags.length === 0 ? (
                  <span className="text-xs text-muted">No features restricted</span>
                ) : (
                  detail.restriction_flags.map((flag) => (
                    <Badge key={flag} className="badge-yellow">
                      {flag.replaceAll('_', ' ')}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-ink">Account action</h3>
                  <p className="mt-0.5 text-xs leading-5 text-muted">
                    Every action is attributed to you and written to the immutable audit log.
                  </p>
                </div>
                <ShieldAlert size={18} className="shrink-0 text-primary" />
              </div>

              {allowedActions.length === 0 ? (
                <p className="mt-4 rounded-xl border border-[#f4d7d2] bg-soft-red p-3 text-xs text-coral">
                  Your staff role cannot apply account actions.
                </p>
              ) : (
                <>
                  <div className="mt-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                      Choose an action
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {allowedActions.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setAction(value)}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                            action === value
                              ? value === 'TERMINATE'
                                ? 'bg-coral text-white'
                                : 'bg-ink text-white'
                              : 'border border-line bg-white text-muted hover:text-ink',
                          )}
                        >
                          {ACTION_LABELS[value]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {action === 'TERMINATE' ? (
                    <p className="mt-3 rounded-xl border border-[#f4d7d2] bg-soft-red p-3 text-xs leading-5 text-coral">
                      Permanent termination blocks sign-in, revokes sessions and requires supporting
                      evidence.
                    </p>
                  ) : null}

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Violation category">
                      <Select
                        value={category}
                        onChange={(event) => setCategory(event.target.value as ViolationCategory)}
                      >
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {action === 'SUSPEND' ? (
                      <Field label="Suspension duration (days)">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={duration}
                          onChange={(event) => setDuration(event.target.value)}
                        />
                      </Field>
                    ) : action === 'RESTRICT' ? (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-ink">Features to restrict</p>
                        <div className="flex flex-wrap gap-1.5">
                          {FEATURES.map((feature) => {
                            const checked = features.includes(feature)
                            return (
                              <button
                                key={feature}
                                type="button"
                                onClick={() =>
                                  setFeatures((current) =>
                                    checked ? current.filter((item) => item !== feature) : [...current, feature],
                                  )
                                }
                                className={cn(
                                  'rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                                  checked
                                    ? 'bg-warning text-white'
                                    : 'border border-line bg-white text-muted',
                                )}
                              >
                                {feature.replaceAll('_', ' ')}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    <Field label="Reason" hint="At least 5 characters. Written for the audit record.">
                      <Textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className="min-h-20"
                      />
                    </Field>
                    <Field label="Supporting evidence" hint="Required for permanent termination.">
                      <Textarea
                        value={evidence}
                        onChange={(event) => setEvidence(event.target.value)}
                        className="min-h-16"
                      />
                    </Field>
                    <Field label="Internal notes" hint="Visible only to authorised staff.">
                      <Textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        className="min-h-16"
                      />
                    </Field>
                    {action === 'TERMINATE' ? (
                      <Field label="Type TERMINATE to confirm">
                        <Input value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" />
                      </Field>
                    ) : null}
                  </div>

                  {actionError ? (
                    <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-coral" role="alert">
                      <AlertCircle size={13} className="mt-0.5 shrink-0" />
                      {actionError}
                    </p>
                  ) : null}
                  {actionSuccess ? (
                    <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-success" role="status">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
                      {actionSuccess}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => void applyAction()} loading={saving} disabled={saving}>
                      Apply action
                    </Button>
                    <Button variant="secondary" onClick={closeDetail}>
                      Close
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <History size={15} className="text-primary" />
                <h3 className="font-display text-base font-bold text-ink">Account history</h3>
              </div>
              {detail.recent_actions.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed border-line bg-[#fdfbf7] p-4 text-xs text-muted">
                  No governance actions recorded for this account yet.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {detail.recent_actions.map((record: AccountActionRecord) => (
                    <li key={record.id} className="rounded-xl border border-line p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{record.action_label}</p>
                        <Badge className="badge-gray">{record.category_label}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted">{record.reason}</p>
                      <p className="mt-1 text-[10px] text-muted">
                        {record.actor_name} · {formatDateTime(record.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Gavel size={15} className="text-primary" />
                <h3 className="font-display text-base font-bold text-ink">Appeals</h3>
              </div>
              {detail.appeals.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed border-line bg-[#fdfbf7] p-4 text-xs text-muted">
                  No appeals submitted by this account.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {detail.appeals.map((appeal) => (
                    <li key={appeal.id} className="rounded-xl border border-line p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge
                          className={
                            appeal.status === 'APPROVED'
                              ? 'badge-green'
                              : appeal.status === 'REJECTED'
                                ? 'badge-red'
                                : 'badge-orange'
                          }
                        >
                          {appeal.status.replaceAll('_', ' ')}
                        </Badge>
                        <span className="text-[10px] text-muted">
                          {formatDateTime(appeal.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-ink">{appeal.message}</p>
                      {appeal.decision_reason ? (
                        <p className="mt-1 text-[11px] leading-5 text-muted">
                          Decision: {appeal.decision_reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

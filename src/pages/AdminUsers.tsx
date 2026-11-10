import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
} from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { SelectField, TextInput, TextareaField } from '../components/ui/Field'
import { Eyebrow } from '../components/ui/Layout'
import { useI18n } from '../i18n'
import { controlCopy } from '../i18n/control'
import {
  ApiError,
  applyAdminUserAction,
  downloadAdminUsersCsv,
  fetchAdminUser,
  fetchAdminUsers,
  fetchMyPermissions,
  type AccountActionRecord,
  type AccountActionType,
  type AccountState,
  type AdminUser,
  type AdminUserDetail,
  type ApplyActionPayload,
  type RiskLevel,
  type StaffRole,
  type ViolationCategory,
} from '../lib/api'
import { cn, formatDateTime } from '../lib/utils'

const PAGE_SIZE = 20

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-TZ').format(value)
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

function stateTone(state: AccountState) {
  if (state === 'ACTIVE') return 'success' as const
  if (state === 'WARNING' || state === 'RESTRICTED') return 'warning' as const
  if (state === 'UNDER_REVIEW' || state === 'PENDING_VERIFICATION') return 'orange' as const
  if (state === 'TEMPORARILY_SUSPENDED' || state === 'TERMINATED' || state === 'REJECTED') return 'error' as const
  return 'neutral' as const
}

function riskTone(risk: RiskLevel) {
  if (risk === 'LOW') return 'neutral' as const
  if (risk === 'MEDIUM') return 'warning' as const
  if (risk === 'HIGH') return 'orange' as const
  return 'error' as const
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

const CATEGORY_OPTIONS: ViolationCategory[] = [
  'TERMS_VIOLATION',
  'ILLEGAL_ACTIVITY',
  'FRAUD',
  'FAKE_DOCUMENTS',
  'FOOD_SAFETY',
  'ABUSIVE_BEHAVIOUR',
  'PAYMENT_ABUSE',
  'ACCOUNT_SECURITY',
  'SPAM',
  'OTHER',
]

function ActionRow({ record, actionLabel }: { record: AccountActionRecord; actionLabel: string }) {
  return (
    <li className="relative border-l border-brand-line pb-5 pl-5 last:pb-0">
      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-orange ring-4 ring-white" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-brand-charcoal">{actionLabel}</p>
        <Badge tone="cream">{record.category_label}</Badge>
      </div>
      <p className="mt-1 text-xs leading-5 text-brand-muted">{record.reason}</p>
      <p className="mt-1 text-[0.65rem] text-brand-muted">
        {record.actor_name} · {formatDateTime(record.created_at)}
      </p>
      {record.effective_until ? (
        <p className="mt-1 text-[0.65rem] font-semibold text-brand-warning">
          Until {formatDateTime(record.effective_until)}
        </p>
      ) : null}
    </li>
  )
}

export function AdminUsers() {
  const { lang } = useI18n()
  const d = controlCopy[lang]

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
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
    const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(handle)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, role, stateFilter, risk, ordering])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetchAdminUsers({
        q: debouncedSearch,
        role,
        state: stateFilter,
        risk,
        ordering,
        page,
        page_size: PAGE_SIZE,
      })
      setUsers(response.results)
      setCount(response.count)
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : d.common.error)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, ordering, page, risk, role, stateFilter, d.common.error])

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
        if (active) setPermissionError(d.common.error)
      }
    })()
    return () => {
      active = false
    }
  }, [d.common.error])

  const can = useCallback(
    (permission: string) => permissions.includes('*') || permissions.includes(permission),
    [permissions],
  )

  const allowedActions = useMemo(
    () =>
      (Object.keys(ACTION_PERMISSIONS) as AccountActionType[]).filter((key) =>
        can(ACTION_PERMISSIONS[key]),
      ),
    [can],
  )

  useEffect(() => {
    if (allowedActions.length && !allowedActions.includes(action)) {
      setAction(allowedActions[0])
    }
  }, [action, allowedActions])

  const selectUser = useCallback(
    async (id: number) => {
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
        const response = await fetchAdminUser(id)
        setDetail(response)
      } catch (error) {
        setDetailError(error instanceof ApiError ? error.message : d.common.error)
      } finally {
        setDetailLoading(false)
      }
    },
    [d.common.error],
  )

  const applyAction = async () => {
    if (!detail) return
    setActionError('')
    setActionSuccess('')
    if (action !== 'REVOKE_SESSIONS' && reason.trim().length < 5) {
      setActionError(d.users.reasonRequired)
      return
    }
    if (action === 'TERMINATE') {
      if (evidence.trim().length < 5) {
        setActionError(d.users.evidenceRequired)
        return
      }
      if (confirm.trim().toUpperCase() !== 'TERMINATE') {
        setActionError(d.users.confirmRequired)
        return
      }
    }
    if (action === 'SUSPEND') {
      const days = Number(duration)
      if (!Number.isFinite(days) || days < 1 || days > 365) {
        setActionError(d.users.durationRequired)
        return
      }
    }
    if (action === 'RESTRICT' && features.length === 0) {
      setActionError(d.users.featuresRequired)
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
      const refreshed = await fetchAdminUser(detail.id)
      setDetail(refreshed)
      setActionSuccess(d.users.success)
      setReason('')
      setEvidence('')
      setNotes('')
      setConfirm('')
      setFeatures([])
      await load()
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : d.users.error)
    } finally {
      setSaving(false)
    }
  }

  const exportUsers = async () => {
    setExportError('')
    try {
      await downloadAdminUsersCsv()
    } catch {
      setExportError(d.users.exportError)
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <Eyebrow>{d.users.eyebrow}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-[2.2rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[2.8rem]">
            {d.users.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-brand-muted">{d.users.lead}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {d.common.refresh}
          </Button>
          {can('users.export') ? (
            <Button type="button" variant="dark" size="sm" onClick={() => void exportUsers()}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {d.users.export}
            </Button>
          ) : null}
        </div>
      </header>

      {exportError ? (
        <Alert tone="error" className="mt-5">
          {exportError}
        </Alert>
      ) : null}
      {permissionError ? (
        <Alert tone="warning" className="mt-5">
          {permissionError}
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <div className="surface-card p-4 sm:p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={d.users.searchPlaceholder}
                aria-label={d.common.search}
                className="input-base pl-11"
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SelectField
                label={d.users.roleLabel}
                value={role}
                onChange={(event) => setRole(event.target.value)}
                options={[
                  { value: 'all', label: d.common.all },
                  { value: 'customer', label: 'Customers' },
                  { value: 'vendor', label: 'Vendors' },
                  { value: 'rider', label: 'Riders' },
                  { value: 'admin', label: 'Admins' },
                ]}
              />
              <SelectField
                label={d.users.stateLabel}
                value={stateFilter}
                onChange={(event) => setStateFilter(event.target.value)}
                options={[
                  { value: 'all', label: d.common.all },
                  ...Object.entries(d.states).map(([value, label]) => ({ value, label })),
                ]}
              />
              <SelectField
                label={d.users.riskLabel}
                value={risk}
                onChange={(event) => setRisk(event.target.value)}
                options={[
                  { value: 'all', label: d.common.all },
                  ...Object.entries(d.risk).map(([value, label]) => ({ value, label })),
                ]}
              />
              <SelectField
                label={d.common.actions}
                value={ordering}
                onChange={(event) => setOrdering(event.target.value)}
                options={[
                  { value: '-date_joined', label: 'Newest accounts' },
                  { value: 'date_joined', label: 'Oldest accounts' },
                  { value: '-last_login', label: 'Recent sign-ins' },
                  { value: '-violation_count', label: 'Most violations' },
                  { value: '-risk_score', label: 'Highest risk' },
                  { value: '-order_count', label: 'Most orders' },
                ]}
              />
            </div>
          </div>

          {loadError ? (
            <Alert tone="error" className="mt-4" title={d.common.error}>
              {loadError}
            </Alert>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-2xl border border-brand-line bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-brand-line bg-brand-cream/60 px-4 py-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                {formatNumber(count)} {d.users.shown}
              </p>
              <p className="text-[0.65rem] text-brand-muted">
                {d.common.page} {page} {d.common.of} {totalPages}
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-r-transparent" aria-label={d.common.loading} />
              </div>
            ) : users.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <UserRound className="mx-auto h-7 w-7 text-brand-muted" aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-brand-charcoal">{d.users.emptyTitle}</p>
                <p className="mt-1 text-xs text-brand-muted">{d.users.emptyBody}</p>
              </div>
            ) : (
              <ul className="divide-y divide-brand-line">
                {users.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => void selectUser(user.id)}
                      className={cn(
                        'grid w-full gap-2 px-4 py-3.5 text-left transition hover:bg-brand-cream/50 sm:grid-cols-[minmax(0,1.4fr)_0.7fr_0.8fr_0.7fr] sm:items-center sm:gap-3',
                        selectedId === user.id && 'bg-brand-cream/70',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-brand-charcoal">{user.name}</p>
                        <p className="mt-0.5 truncate text-[0.68rem] text-brand-muted">
                          {user.phone || user.email || user.username}
                          {user.business_name ? ` · ${user.business_name}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={user.role === 'ADMIN' ? 'dark' : 'cream'}>{user.role.toLowerCase()}</Badge>
                        {user.staff_role !== 'NONE' ? (
                          <span className="text-[0.6rem] font-semibold text-brand-muted">{d.staffRoles[user.staff_role as StaffRole]}</span>
                        ) : null}
                      </div>
                      <div>
                        <Badge tone={stateTone(user.account_state)}>{d.states[user.account_state]}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <Badge tone={riskTone(user.risk_level)}>{d.risk[user.risk_level]}</Badge>
                        <ChevronRight className="h-4 w-4 shrink-0 text-brand-muted" aria-hidden="true" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-brand-line px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                {d.common.previous}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                {d.common.next}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </section>

        <section className="min-w-0">
          {!selectedId ? (
            <div className="surface-card flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-cream text-brand-dark ring-1 ring-brand-line">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 max-w-sm text-sm leading-6 text-brand-muted">{d.users.selectPrompt}</p>
            </div>
          ) : detailLoading ? (
            <div className="surface-card flex min-h-64 items-center justify-center py-16">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-r-transparent" aria-label={d.common.loading} />
            </div>
          ) : detailError ? (
            <Alert tone="error" title={d.common.error}>{detailError}</Alert>
          ) : detail ? (
            <div className="space-y-4">
              <article className="surface-card overflow-hidden">
                <div className="border-b border-brand-line bg-brand-cream/60 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
                        {d.users.account}
                      </p>
                      <h2 className="mt-1 truncate font-display text-xl font-extrabold tracking-[-0.03em] text-brand-charcoal">
                        {detail.name}
                      </h2>
                      <p className="mt-1 truncate text-xs text-brand-muted">
                        {detail.phone || detail.email || detail.username} · #{detail.id}
                      </p>
                    </div>
                    <Badge tone={stateTone(detail.account_state)}>{d.states[detail.account_state]}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
                  <div>
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.users.orders}</p>
                    <p className="mt-1 text-sm font-bold text-brand-charcoal">{formatNumber(detail.order_count)}</p>
                  </div>
                  <div>
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.users.lifetime}</p>
                    <p className="mt-1 text-sm font-bold text-brand-charcoal">{formatTZS(detail.lifetime_value)}</p>
                  </div>
                  <div>
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.users.violations}</p>
                    <p className="mt-1 text-sm font-bold text-brand-charcoal">{formatNumber(detail.violation_count)}</p>
                  </div>
                  <div>
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.users.riskScore}</p>
                    <p className="mt-1 text-sm font-bold text-brand-charcoal">
                      {detail.risk_score} · {d.risk[detail.risk_level]}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.users.joined}</p>
                    <p className="mt-1 text-xs font-semibold text-brand-charcoal">{formatDateTime(detail.date_joined)}</p>
                  </div>
                  <div>
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.users.lastLogin}</p>
                    <p className="mt-1 text-xs font-semibold text-brand-charcoal">{formatDateTime(detail.last_login)}</p>
                  </div>
                </div>

                {detail.account_state_reason ? (
                  <div className="border-t border-brand-line px-5 py-4">
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.users.stateReason}</p>
                    <p className="mt-1 text-xs leading-5 text-brand-charcoal">{detail.account_state_reason}</p>
                    {detail.suspended_until ? (
                      <p className="mt-1 text-xs font-semibold text-brand-warning">
                        {d.users.suspendedUntil} {formatDateTime(detail.suspended_until)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="border-t border-brand-line px-5 py-4">
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.users.restrictions}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {detail.restriction_flags.length === 0 ? (
                      <span className="text-xs text-brand-muted">{d.users.noRestrictions}</span>
                    ) : (
                      detail.restriction_flags.map((flag) => (
                        <Badge key={flag} tone="warning">{flag.replaceAll('_', ' ')}</Badge>
                      ))
                    )}
                  </div>
                </div>
              </article>

              <article className="surface-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-extrabold tracking-[-0.03em] text-brand-charcoal">
                      {d.users.actionPanel}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-brand-muted">{d.users.actionPanelBody}</p>
                  </div>
                  <ShieldAlert className="h-5 w-5 shrink-0 text-brand-dark" aria-hidden="true" />
                </div>

                {allowedActions.length === 0 ? (
                  <Alert tone="warning" className="mt-4">
                    Your staff role cannot apply account actions.
                  </Alert>
                ) : (
                  <>
                    <div className="mt-4">
                      <p className="field-label">{d.users.chooseAction}</p>
                      <div className="flex flex-wrap gap-2">
                        {allowedActions.map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setAction(value)}
                            aria-pressed={action === value}
                            className={cn(
                              'rounded-full px-3 py-2 text-xs font-bold transition',
                              action === value
                                ? value === 'TERMINATE'
                                  ? 'bg-brand-error text-white'
                                  : 'bg-brand-charcoal text-white'
                                : 'border border-brand-line bg-white text-brand-muted hover:text-brand-charcoal',
                            )}
                          >
                            {d.actionLabels[value]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {action === 'TERMINATE' ? (
                      <div className="mt-4 rounded-2xl border border-brand-error/30 bg-brand-error/5 p-4 text-xs leading-5 text-brand-error">
                        {d.users.terminateWarning}
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <SelectField
                        label={d.common.category}
                        value={category}
                        onChange={(event) => setCategory(event.target.value as ViolationCategory)}
                        options={CATEGORY_OPTIONS.map((value) => ({
                          value,
                          label: d.categories[value],
                        }))}
                      />
                      {action === 'SUSPEND' ? (
                        <TextInput
                          label={d.users.duration}
                          type="number"
                          min={1}
                          max={365}
                          value={duration}
                          onChange={(event) => setDuration(event.target.value)}
                        />
                      ) : action === 'RESTRICT' ? (
                        <div>
                          <p className="field-label">{d.users.features}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              'ordering',
                              'delivery',
                              'vendor_payouts',
                              'rider_jobs',
                              'chat',
                              'reviews',
                              'new_applications',
                              'payouts',
                            ].map((feature) => {
                              const checked = features.includes(feature)
                              return (
                                <button
                                  key={feature}
                                  type="button"
                                  aria-pressed={checked}
                                  onClick={() =>
                                    setFeatures((current) =>
                                      checked ? current.filter((item) => item !== feature) : [...current, feature],
                                    )
                                  }
                                  className={cn(
                                    'rounded-full px-3 py-1.5 text-[0.68rem] font-bold transition',
                                    checked
                                      ? 'bg-brand-warning text-white'
                                      : 'border border-brand-line bg-white text-brand-muted',
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

                    <div className="mt-4">
                      <TextareaField
                        label={d.users.actionReason}
                        hint={d.users.actionReasonHint}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className="min-h-24"
                      />
                    </div>

                    <div className="mt-4">
                      <TextareaField
                        label={d.users.evidence}
                        hint={d.users.evidenceHint}
                        value={evidence}
                        onChange={(event) => setEvidence(event.target.value)}
                        className="min-h-20"
                      />
                    </div>

                    <div className="mt-4">
                      <TextareaField
                        label={d.users.notes}
                        hint={d.users.notesHint}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        className="min-h-20"
                      />
                    </div>

                    {action === 'TERMINATE' ? (
                      <div className="mt-4">
                        <TextInput
                          label={d.users.confirm}
                          hint={d.users.confirmHint}
                          value={confirm}
                          onChange={(event) => setConfirm(event.target.value)}
                          autoComplete="off"
                        />
                      </div>
                    ) : null}

                    {actionError ? (
                      <p className="mt-4 flex items-start gap-1.5 text-xs font-medium text-brand-error" role="alert">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {actionError}
                      </p>
                    ) : null}
                    {actionSuccess ? (
                      <p className="mt-4 flex items-start gap-1.5 text-xs font-medium text-brand-success" role="status">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {actionSuccess}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button type="button" onClick={() => void applyAction()} loading={saving} disabled={saving}>
                        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                        {saving ? d.users.applying : d.users.apply}
                      </Button>
                      <span className="text-[0.68rem] text-brand-muted">
                        {d.users.applyFor} {detail.name}
                      </span>
                    </div>
                  </>
                )}
              </article>

              <article className="surface-card p-5">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                  <h2 className="font-display text-lg font-extrabold tracking-[-0.03em] text-brand-charcoal">
                    {d.users.history}
                  </h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-brand-muted">{d.users.historyBody}</p>
                {detail.recent_actions.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-dashed border-brand-line bg-brand-cream/50 p-4 text-xs text-brand-muted">
                    {d.users.noHistory}
                  </p>
                ) : (
                  <ol className="mt-5">
                    {detail.recent_actions.map((record) => (
                      <ActionRow
                        key={record.id}
                        record={record}
                        actionLabel={d.actionLabels[record.action as AccountActionType] || record.action_label}
                      />
                    ))}
                  </ol>
                )}
              </article>

              <article className="surface-card p-5">
                <h2 className="font-display text-lg font-extrabold tracking-[-0.03em] text-brand-charcoal">
                  {d.users.appeals}
                </h2>
                {detail.appeals.length === 0 ? (
                  <p className="mt-3 text-xs text-brand-muted">{d.users.noAppeals}</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {detail.appeals.map((appeal) => (
                      <li key={appeal.id} className="rounded-2xl border border-brand-line bg-brand-cream/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge tone={appeal.status === 'APPROVED' ? 'success' : appeal.status === 'REJECTED' ? 'error' : 'orange'}>
                            {appeal.status.replaceAll('_', ' ')}
                          </Badge>
                          <span className="text-[0.65rem] text-brand-muted">{formatDateTime(appeal.created_at)}</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-brand-charcoal">{appeal.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}

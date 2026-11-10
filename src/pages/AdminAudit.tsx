import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, ShieldCheck } from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { SelectField, TextInput } from '../components/ui/Field'
import { Eyebrow } from '../components/ui/Layout'
import { useI18n } from '../i18n'
import { controlCopy } from '../i18n/control'
import {
  ApiError,
  fetchAdminAudit,
  type AdminAuditRecord,
} from '../lib/api'
import { formatDateTime } from '../lib/utils'

const PAGE_SIZE = 20

function pretty(value: Record<string, unknown>) {
  if (!value || Object.keys(value).length === 0) return '—'
  return JSON.stringify(value, null, 2)
}

export function AdminAudit() {
  const { lang } = useI18n()
  const d = controlCopy[lang]

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [targetType, setTargetType] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [records, setRecords] = useState<AdminAuditRecord[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(search.trim()), 350)
    return () => window.clearTimeout(handle)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debounced, actionFilter, targetType, from, to])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetchAdminAudit({
        q: debounced,
        action: actionFilter,
        target_type: targetType,
        from,
        to,
        page,
      })
      setRecords(response.results)
      setCount(response.count)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : d.audit.error)
    } finally {
      setLoading(false)
    }
  }, [actionFilter, debounced, d.audit.error, from, page, targetType, to])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <Eyebrow>{d.audit.eyebrow}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-[2.2rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[2.8rem]">
            {d.audit.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-brand-muted">{d.audit.lead}</p>
        </div>
        <Badge tone="success">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {d.audit.immutable}
        </Badge>
      </header>

      <div className="surface-card mt-6 p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={d.audit.searchPlaceholder}
            aria-label={d.common.search}
            className="input-base pl-11"
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label={d.audit.actionFilter}
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            options={[
              { value: 'all', label: d.common.all },
              { value: 'account.warning', label: d.actionLabels.WARNING },
              { value: 'account.suspend', label: d.actionLabels.SUSPEND },
              { value: 'account.terminate', label: d.actionLabels.TERMINATE },
              { value: 'account.restrict', label: d.actionLabels.RESTRICT },
              { value: 'account.restore', label: d.actionLabels.RESTORE },
              { value: 'account.disable_login', label: d.actionLabels.DISABLE_LOGIN },
              { value: 'staff.role_changed', label: 'Staff role changed' },
              { value: 'appeal.decided', label: 'Appeal decided' },
              { value: 'appeal.created', label: 'Appeal created' },
              { value: 'users.exported', label: 'Users exported' },
            ]}
          />
          <SelectField
            label={d.audit.targetFilter}
            value={targetType}
            onChange={(event) => setTargetType(event.target.value)}
            options={[
              { value: 'all', label: d.common.all },
              { value: 'user', label: 'User' },
              { value: 'appeal', label: 'Appeal' },
            ]}
          />
          <TextInput label={d.audit.from} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <TextInput label={d.audit.to} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </div>

      {error ? (
        <Alert tone="error" className="mt-5" title={d.audit.error}>{error}</Alert>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-brand-line bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-brand-line bg-brand-cream/60 px-4 py-3">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-muted">{count} records</p>
          <p className="text-[0.65rem] text-brand-muted">
            {d.common.page} {page} {d.common.of} {totalPages}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-r-transparent" aria-label={d.common.loading} />
          </div>
        ) : records.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-brand-muted">{d.audit.empty}</p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {records.map((record) => (
              <li key={record.id}>
                <details className="group">
                  <summary className="grid cursor-pointer gap-2 px-4 py-3.5 transition hover:bg-brand-cream/40 sm:grid-cols-[1.2fr_0.9fr_0.9fr_auto] sm:items-center sm:gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-brand-charcoal">{record.target_label || record.target_id || '—'}</p>
                      <p className="mt-0.5 truncate text-[0.65rem] text-brand-muted">{record.action}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.audit.actor}</p>
                      <p className="mt-0.5 truncate text-xs text-brand-charcoal">{record.actor_name || record.actor_label || 'System'}</p>
                    </div>
                    <div>
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.audit.when}</p>
                      <p className="mt-0.5 text-xs text-brand-charcoal">{formatDateTime(record.created_at)}</p>
                    </div>
                    <Badge tone={record.action.includes('terminate') ? 'error' : record.action.includes('suspend') || record.action.includes('restrict') ? 'warning' : 'neutral'}>
                      {record.target_type || 'system'}
                    </Badge>
                  </summary>

                  <div className="border-t border-brand-line bg-brand-cream/40 px-4 py-4">
                    {record.reason ? (
                      <div className="mb-4">
                        <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.common.reason}</p>
                        <p className="mt-1 text-xs leading-5 text-brand-charcoal">{record.reason}</p>
                      </div>
                    ) : null}
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.audit.previousValues}</p>
                        <pre className="mt-1 max-h-56 overflow-auto rounded-xl border border-brand-line bg-white p-3 text-[0.65rem] leading-5 text-brand-charcoal">{pretty(record.previous_values)}</pre>
                      </div>
                      <div>
                        <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.audit.newValues}</p>
                        <pre className="mt-1 max-h-56 overflow-auto rounded-xl border border-brand-line bg-white p-3 text-[0.65rem] leading-5 text-brand-charcoal">{pretty(record.new_values)}</pre>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.audit.metadata}</p>
                      <pre className="mt-1 max-h-40 overflow-auto rounded-xl border border-brand-line bg-white p-3 text-[0.65rem] leading-5 text-brand-charcoal">{pretty(record.request_metadata)}</pre>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-brand-line px-4 py-3">
          <Button type="button" variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {d.common.previous}
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
            {d.common.next}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

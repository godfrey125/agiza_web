import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ScrollText, ShieldCheck } from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Pagination,
  SearchInput,
  SectionCard,
  Select,
} from '../../components/ui'
import { formatDateTime } from '../../lib/format'
import {
  fetchAdminAudit,
  MarketplaceApiError,
  type AdminAuditRecord,
} from '../../lib/marketplace'

const PAGE_SIZE = 20

const ACTION_OPTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'account.warning', label: 'Account warning' },
  { value: 'account.suspend', label: 'Account suspended' },
  { value: 'account.terminate', label: 'Account terminated' },
  { value: 'account.restrict', label: 'Account restricted' },
  { value: 'account.restore', label: 'Account restored' },
  { value: 'account.disable_login', label: 'Sign-in disabled' },
  { value: 'staff.role_changed', label: 'Staff role changed' },
  { value: 'appeal.decided', label: 'Appeal decided' },
  { value: 'appeal.created', label: 'Appeal created' },
  { value: 'users.exported', label: 'Users exported' },
]

function pretty(value: Record<string, unknown>) {
  if (!value || Object.keys(value).length === 0) return '—'
  return JSON.stringify(value, null, 2)
}

export default function MarketplaceAudit() {
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
      setError(cause instanceof MarketplaceApiError ? cause.message : 'The audit log could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [actionFilter, debounced, from, page, targetType, to])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Marketplace"
        title="Audit log"
        description="Every governance, role and export action is recorded with administrator identity, reason, values and request metadata."
        actions={
          <>
            <Badge className="badge-green">
              <ShieldCheck size={13} />
              Append-only
            </Badge>
            <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
              <RefreshCw size={13} />
              Refresh
            </Button>
          </>
        }
      />

      <SectionCard title="Filters" description="Search the immutable trail by action, target or date.">
        <div className="space-y-4">
          <Field label="Search">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Target, reason or action"
              className="w-full sm:w-full"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Action">
              <Select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
                {ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Target type">
              <Select value={targetType} onChange={(event) => setTargetType(event.target.value)}>
                <option value="all">All</option>
                <option value="user">User</option>
                <option value="appeal">Appeal</option>
              </Select>
            </Field>
            <Field label="From date">
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="To date">
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
          </div>
        </div>
      </SectionCard>

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <LoadingBlock rows={8} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={22} />}
          title="No audit records match these filters"
          message="Change the action, target or date range and try again."
        />
      ) : (
        <SectionCard
          title={`${count} records`}
          description="Expand a record to see previous and new values."
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-line">
            {records.map((record) => (
              <li key={record.id}>
                <details className="group">
                  <summary className="grid cursor-pointer gap-2 px-4 py-3.5 transition hover:bg-[#fffdf9] sm:grid-cols-[1.2fr_0.9fr_0.9fr_auto] sm:items-center sm:gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {record.target_label || record.target_id || '—'}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted">{record.action}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                        Administrator
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink">
                        {record.actor_name || record.actor_label || 'System'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">When</p>
                      <p className="mt-0.5 text-xs text-ink">{formatDateTime(record.created_at)}</p>
                    </div>
                    <Badge
                      className={
                        record.action.includes('terminate')
                          ? 'badge-red'
                          : record.action.includes('suspend') || record.action.includes('restrict')
                            ? 'badge-yellow'
                            : 'badge-gray'
                      }
                    >
                      {record.target_type || 'system'}
                    </Badge>
                  </summary>

                  <div className="border-t border-line bg-[#fdfbf7] px-4 py-4">
                    {record.reason ? (
                      <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Reason</p>
                        <p className="mt-1 text-xs leading-5 text-ink">{record.reason}</p>
                      </div>
                    ) : null}
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                          Previous values
                        </p>
                        <pre className="mt-1 max-h-56 overflow-auto rounded-xl border border-line bg-white p-3 text-[10px] leading-5 text-ink">
                          {pretty(record.previous_values)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                          New values
                        </p>
                        <pre className="mt-1 max-h-56 overflow-auto rounded-xl border border-line bg-white p-3 text-[10px] leading-5 text-ink">
                          {pretty(record.new_values)}
                        </pre>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                        Request metadata
                      </p>
                      <pre className="mt-1 max-h-40 overflow-auto rounded-xl border border-line bg-white p-3 text-[10px] leading-5 text-ink">
                        {pretty(record.request_metadata)}
                      </pre>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={count} onChange={setPage} />
        </SectionCard>
      )}
    </div>
  )
}

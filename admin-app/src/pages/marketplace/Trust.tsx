import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Gavel,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserX,
} from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  SectionCard,
  Select,
  Textarea,
} from '../../components/ui'
import { cn, formatDateTime, number } from '../../lib/format'
import {
  decideAdminAppeal,
  fetchAdminAppeals,
  fetchAdminSummary,
  MarketplaceApiError,
  type AdminAppeal,
  type AdminSummary,
  type RiskLevel,
} from '../../lib/marketplace'

const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = 'orange',
}: {
  icon: typeof ShieldAlert
  label: string
  value: string
  tone?: 'orange' | 'green' | 'red' | 'blue'
}) {
  const tones = {
    orange: 'bg-peach text-primary',
    green: 'bg-soft-green text-success',
    red: 'bg-soft-red text-coral',
    blue: 'bg-[#EEF4FF] text-[#3569B4]',
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
          <p className="mt-2 font-display text-3xl font-extrabold tracking-[-0.04em] text-ink">{value}</p>
        </div>
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
          <Icon size={18} />
        </span>
      </div>
    </div>
  )
}

export default function MarketplaceTrust() {
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [appeals, setAppeals] = useState<AdminAppeal[]>([])
  const [appealFilter, setAppealFilter] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [appealError, setAppealError] = useState('')

  const [selected, setSelected] = useState<AdminAppeal | null>(null)
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | 'UNDER_REVIEW'>('UNDER_REVIEW')
  const [decisionReason, setDecisionReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [decisionError, setDecisionError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setAppealError('')
    try {
      const [summaryResponse, appealsResponse] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminAppeals(appealFilter),
      ])
      setSummary(summaryResponse)
      setAppeals(appealsResponse.results)
    } catch (cause) {
      if (cause instanceof MarketplaceApiError && cause.status === 403) {
        setError('Your staff role does not include trust and safety access.')
      } else {
        setError(cause instanceof Error ? cause.message : 'Trust and safety data could not be loaded.')
      }
    } finally {
      setLoading(false)
    }
  }, [appealFilter])

  useEffect(() => {
    void load()
  }, [load])

  const riskTotal = useMemo(() => {
    if (!summary) return 1
    return Math.max(
      1,
      summary.risk.low + summary.risk.medium + summary.risk.high + summary.risk.critical,
    )
  }, [summary])

  const decide = async () => {
    if (!selected) return
    setDecisionError('')
    setSuccess('')
    if (decisionReason.trim().length < 5) {
      setDecisionError('Enter a decision reason of at least 5 characters.')
      return
    }
    setSaving(true)
    try {
      await decideAdminAppeal(selected.id, decision, decisionReason.trim())
      setSuccess('Appeal decision recorded.')
      setDecisionReason('')
      setSelected(null)
      await load()
    } catch (cause) {
      setDecisionError(
        cause instanceof MarketplaceApiError ? cause.message : 'The appeal could not be updated.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading && !summary) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Marketplace"
          title="Trust & safety"
          description="Review violations, investigations and appeals across the marketplace."
        />
        <LoadingBlock rows={8} />
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Marketplace" title="Trust & safety" />
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Marketplace"
        title="Trust & safety"
        description="Review violations, investigations and appeals. Restrict accounts that break platform rules and keep every decision accountable."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCw size={13} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <p className="flex items-start gap-1.5 rounded-xl border border-[#f4d7d2] bg-soft-red px-4 py-3 text-xs text-coral">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="flex items-center gap-1.5 rounded-xl border border-[#cfe9d8] bg-soft-green px-4 py-3 text-xs font-medium text-success">
          <CheckCircle2 size={14} />
          {success}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Gavel} label="Actions recorded" value={number(summary?.governance.total_actions || 0)} />
        <Metric icon={ShieldAlert} label="Actions this week" value={number(summary?.governance.actions_7d || 0)} tone="blue" />
        <Metric icon={UserX} label="Open investigations" value={number(summary?.governance.open_investigations || 0)} tone="red" />
        <Metric icon={CheckCircle2} label="Pending appeals" value={number(summary?.governance.pending_appeals || 0)} tone="green" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <SectionCard title="Risk distribution" description="Accounts by current risk level.">
          <div className="space-y-4">
            {(Object.keys(RISK_LABELS) as RiskLevel[]).map((level) => {
              const value = summary?.risk[level.toLowerCase() as 'low' | 'medium' | 'high' | 'critical'] || 0
              return (
                <div key={level}>
                  <div className="flex items-center justify-between gap-3">
                    <Badge
                      className={
                        level === 'LOW'
                          ? 'badge-green'
                          : level === 'MEDIUM'
                            ? 'badge-yellow'
                            : level === 'HIGH'
                              ? 'badge-orange'
                              : 'badge-red'
                      }
                    >
                      {RISK_LABELS[level]}
                    </Badge>
                    <span className="text-xs font-bold tabular-nums text-ink">{number(value)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f2ede6]">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        level === 'LOW'
                          ? 'bg-success'
                          : level === 'MEDIUM'
                            ? 'bg-warning'
                            : level === 'HIGH'
                              ? 'bg-coral'
                              : 'bg-ink',
                      )}
                      style={{ width: `${Math.max(3, Math.round((value / riskTotal) * 100))}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-2 border-t border-line pt-4">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Suspended</dt>
              <dd className="mt-1 font-display text-xl font-extrabold text-ink">
                {number(summary?.account_states.temporarily_suspended || 0)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Restricted</dt>
              <dd className="mt-1 font-display text-xl font-extrabold text-ink">
                {number(summary?.account_states.restricted || 0)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Terminated</dt>
              <dd className="mt-1 font-display text-xl font-extrabold text-ink">
                {number(summary?.account_states.terminated || 0)}
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Recent enforcement" description="The latest governance actions across all account types.">
          {!summary?.recent_actions?.length ? (
            <p className="rounded-xl border border-dashed border-line bg-[#fdfbf7] p-4 text-xs text-muted">
              No enforcement actions recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {summary.recent_actions.map((record) => (
                <li
                  key={record.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{record.action_label}</p>
                      <Badge className="badge-gray">{record.category_label}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{record.reason}</p>
                    <p className="mt-1 text-[10px] text-muted">
                      {record.actor_name} · {formatDateTime(record.created_at)}
                    </p>
                  </div>
                  <Badge
                    className={
                      record.new_state === 'TERMINATED'
                        ? 'badge-red'
                        : record.new_state === 'RESTRICTED'
                          ? 'badge-yellow'
                          : 'badge-orange'
                    }
                  >
                    {record.new_state.replaceAll('_', ' ')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Appeals queue"
        description="Users can appeal warnings, restrictions, suspensions and terminations."
        action={
          <div className="w-52">
            <Select
              value={appealFilter}
              onChange={(event) => {
                setAppealFilter(event.target.value)
                setSelected(null)
              }}
            >
              <option value="PENDING">Pending</option>
              <option value="UNDER_REVIEW">Under review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="all">All</option>
            </Select>
          </div>
        }
      >
        {appealError ? (
          <p className="rounded-xl border border-[#f4d7d2] bg-soft-red px-4 py-3 text-xs text-coral">
            {appealError}
          </p>
        ) : null}

        {loading ? (
          <LoadingBlock rows={4} />
        ) : appeals.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={22} />}
            title="No appeals in this filter"
            message="Change the status filter to see other appeals."
          />
        ) : (
          <ul className="divide-y divide-line">
            {appeals.map((appeal) => (
              <li key={appeal.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(appeal)
                    setDecision(appeal.status === 'PENDING' ? 'UNDER_REVIEW' : 'APPROVED')
                    setDecisionReason('')
                    setDecisionError('')
                  }}
                  className={cn(
                    'flex w-full flex-col gap-2 py-3 text-left transition hover:bg-[#fffdf9] sm:flex-row sm:items-start sm:justify-between',
                    selected?.id === appeal.id && 'bg-[#fffaf3]',
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{appeal.user_name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted">{appeal.message}</p>
                    <p className="mt-1 text-[10px] text-muted">
                      {appeal.action_label || 'Appeal'} · {formatDateTime(appeal.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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
                    <ChevronRight size={15} className="text-muted" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <div className="mt-4 rounded-xl border border-line bg-[#fdfbf7] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Review appeal</p>
                <h3 className="mt-1 font-display text-lg font-extrabold text-ink">{selected.user_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs font-semibold text-muted underline underline-offset-4"
              >
                Close
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-line bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">User statement</p>
              <p className="mt-1 text-xs leading-5 text-ink">{selected.message}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ['UNDER_REVIEW', 'Mark under review'],
                  ['APPROVED', 'Approve and restore'],
                  ['REJECTED', 'Reject appeal'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDecision(value)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    decision === value
                      ? value === 'APPROVED'
                        ? 'bg-success text-white'
                        : value === 'REJECTED'
                          ? 'bg-coral text-white'
                          : 'bg-ink text-white'
                      : 'border border-line bg-white text-muted hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <Field label="Decision reason" hint="At least 5 characters.">
                <Textarea
                  value={decisionReason}
                  onChange={(event) => setDecisionReason(event.target.value)}
                  className="min-h-20"
                />
              </Field>
            </div>

            {decisionError ? (
              <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-coral" role="alert">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {decisionError}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void decide()} loading={saving} disabled={saving}>
                <CheckCircle2 size={15} />
                Record decision
              </Button>
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}

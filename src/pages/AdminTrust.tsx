import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Gavel,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserX,
} from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { SelectField, TextareaField } from '../components/ui/Field'
import { Eyebrow } from '../components/ui/Layout'
import { useI18n } from '../i18n'
import { controlCopy } from '../i18n/control'
import {
  ApiError,
  decideAdminAppeal,
  fetchAdminAppeals,
  fetchAdminSummary,
  type AccountActionRecord,
  type AccountActionType,
  type AdminAppeal,
  type AdminSummary,
  type RiskLevel,
} from '../lib/api'
import { cn, formatDateTime } from '../lib/utils'

function riskTone(risk: RiskLevel) {
  if (risk === 'LOW') return 'neutral' as const
  if (risk === 'MEDIUM') return 'warning' as const
  if (risk === 'HIGH') return 'orange' as const
  return 'error' as const
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
  tone?: 'orange' | 'dark' | 'success' | 'error'
}) {
  const toneClass = {
    orange: 'bg-brand-orange/10 text-brand-dark',
    dark: 'bg-brand-charcoal/10 text-brand-charcoal',
    success: 'bg-brand-success/10 text-brand-success',
    error: 'bg-brand-error/10 text-brand-error',
  }[tone]

  return (
    <article className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-brand-muted">{label}</p>
          <p className="mt-3 font-display text-3xl font-extrabold tracking-[-0.05em] text-brand-charcoal">{value}</p>
        </div>
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', toneClass)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </article>
  )
}

function EnforcementRow({
  record,
  actionLabel,
}: {
  record: AccountActionRecord
  actionLabel: string
}) {
  return (
    <li className="flex flex-col gap-2 border-b border-brand-line py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-brand-charcoal">{actionLabel}</p>
          <Badge tone="cream">{record.category_label}</Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-brand-muted">{record.reason}</p>
        <p className="mt-1 text-[0.65rem] text-brand-muted">
          {record.actor_name} · {formatDateTime(record.created_at)}
        </p>
      </div>
      <Badge tone={record.new_state === 'TERMINATED' ? 'error' : record.new_state === 'RESTRICTED' ? 'warning' : 'orange'}>
        {record.new_state.replaceAll('_', ' ')}
      </Badge>
    </li>
  )
}

export function AdminTrust() {
  const { lang } = useI18n()
  const d = controlCopy[lang]

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
  const [decisionSuccess, setDecisionSuccess] = useState('')

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
      if (cause instanceof ApiError && cause.status === 403) {
        setError('Your staff role does not include trust and safety access.')
      } else {
        setError(cause instanceof Error ? cause.message : d.common.error)
      }
    } finally {
      setLoading(false)
    }
  }, [appealFilter, d.common.error])

  useEffect(() => {
    void load()
  }, [load])

  const riskMax = useMemo(() => {
    if (!summary) return 1
    return Math.max(1, ...Object.values(summary.risk))
  }, [summary])

  const decide = async () => {
    if (!selected) return
    setDecisionError('')
    setDecisionSuccess('')
    if (decisionReason.trim().length < 5) {
      setDecisionError(d.trust.decisionError)
      return
    }
    setSaving(true)
    try {
      await decideAdminAppeal(selected.id, decision, decisionReason.trim())
      setDecisionSuccess(d.trust.decisionSuccess)
      setDecisionReason('')
      setSelected(null)
      await load()
    } catch (cause) {
      setDecisionError(cause instanceof ApiError ? cause.message : d.trust.decisionError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <Eyebrow>{d.trust.eyebrow}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-[2.2rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[2.8rem]">
            {d.trust.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-brand-muted">{d.trust.lead}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {d.common.refresh}
        </Button>
      </header>

      {error ? (
        <Alert tone="error" className="mt-5" title={d.common.error}>{error}</Alert>
      ) : null}
      {decisionSuccess ? (
        <Alert tone="success" className="mt-5">{decisionSuccess}</Alert>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Gavel}
          label={d.trust.totalActions}
          value={summary ? String(summary.governance.total_actions) : '—'}
        />
        <Metric
          icon={ShieldAlert}
          label={d.trust.actions7d}
          value={summary ? String(summary.governance.actions_7d) : '—'}
          tone="dark"
        />
        <Metric
          icon={UserX}
          label={d.trust.investigations}
          value={summary ? String(summary.governance.open_investigations) : '—'}
          tone="error"
        />
        <Metric
          icon={CheckCircle2}
          label={d.trust.appeals}
          value={summary ? String(summary.governance.pending_appeals) : '—'}
          tone="success"
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.35fr]">
        <section className="surface-card p-5">
          <h2 className="font-display text-lg font-extrabold tracking-[-0.03em] text-brand-charcoal">{d.trust.riskTitle}</h2>
          <p className="mt-1 text-xs leading-5 text-brand-muted">{d.trust.riskBody}</p>
          {!summary ? (
            <p className="mt-4 text-xs text-brand-muted">{d.common.loading}</p>
          ) : (
            <div className="mt-5 space-y-4">
              {(Object.keys(d.risk) as RiskLevel[]).map((level) => {
                const value = summary.risk[level.toLowerCase() as 'low' | 'medium' | 'high' | 'critical']
                return (
                  <div key={level}>
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone={riskTone(level)}>{d.risk[level]}</Badge>
                      <span className="text-xs font-bold tabular-nums text-brand-charcoal">{value}</span>
                    </div>
                    <div className="mt-1.5 h-8 overflow-hidden rounded-lg bg-brand-cream">
                      <div
                        className={cn(
                          'h-full rounded-lg',
                          level === 'CRITICAL' || level === 'HIGH'
                            ? 'bg-brand-error'
                            : level === 'MEDIUM'
                              ? 'bg-brand-warning'
                              : 'bg-brand-charcoal',
                        )}
                        style={{ width: `${Math.max(3, Math.round((value / riskMax) * 100))}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {summary ? (
            <dl className="mt-6 grid grid-cols-3 gap-2 border-t border-brand-line pt-4">
              <div>
                <dt className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.trust.suspendedAccounts}</dt>
                <dd className="mt-1 font-display text-xl font-extrabold text-brand-charcoal">{summary.account_states.temporarily_suspended}</dd>
              </div>
              <div>
                <dt className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.trust.restrictedAccounts}</dt>
                <dd className="mt-1 font-display text-xl font-extrabold text-brand-charcoal">{summary.account_states.restricted}</dd>
              </div>
              <div>
                <dt className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.trust.terminatedAccounts}</dt>
                <dd className="mt-1 font-display text-xl font-extrabold text-brand-charcoal">{summary.account_states.terminated}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        <section className="surface-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-extrabold tracking-[-0.03em] text-brand-charcoal">{d.trust.recentTitle}</h2>
              <p className="mt-1 text-xs leading-5 text-brand-muted">{d.trust.recentBody}</p>
            </div>
            <ShieldCheck className="h-5 w-5 shrink-0 text-brand-dark" aria-hidden="true" />
          </div>
          {loading && !summary ? (
            <p className="mt-5 text-xs text-brand-muted">{d.common.loading}</p>
          ) : !summary || summary.recent_actions.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-brand-line bg-brand-cream/50 p-4 text-xs text-brand-muted">
              {d.trust.recentEmpty}
            </p>
          ) : (
            <ul className="mt-2">
              {summary.recent_actions.map((record) => (
                <EnforcementRow
                  key={record.id}
                  record={record}
                  actionLabel={d.actionLabels[record.action as AccountActionType] || record.action_label}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="surface-card mt-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-extrabold tracking-[-0.03em] text-brand-charcoal">{d.trust.appealsTitle}</h2>
            <p className="mt-1 text-xs leading-5 text-brand-muted">{d.trust.appealsBody}</p>
          </div>
          <div className="w-full sm:w-56">
            <SelectField
              label={d.common.status}
              value={appealFilter}
              onChange={(event) => {
                setAppealFilter(event.target.value)
                setSelected(null)
              }}
              options={[
                { value: 'PENDING', label: 'Pending' },
                { value: 'UNDER_REVIEW', label: 'Under review' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'REJECTED', label: 'Rejected' },
                { value: 'all', label: d.common.all },
              ]}
            />
          </div>
        </div>

        {appealError ? <Alert tone="error" className="mt-4">{appealError}</Alert> : null}

        {loading ? (
          <p className="mt-5 text-xs text-brand-muted">{d.common.loading}</p>
        ) : appeals.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-dashed border-brand-line bg-brand-cream/50 p-4 text-xs text-brand-muted">
            {d.trust.noAppeals}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-brand-line">
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
                    'flex w-full flex-col gap-2 py-3 text-left transition hover:bg-brand-cream/40 sm:flex-row sm:items-start sm:justify-between',
                    selected?.id === appeal.id && 'bg-brand-cream/60',
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-brand-charcoal">{appeal.user_name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-brand-muted">{appeal.message}</p>
                    <p className="mt-1 text-[0.65rem] text-brand-muted">
                      {appeal.action_label || d.trust.appealsTitle} · {formatDateTime(appeal.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={appeal.status === 'APPROVED' ? 'success' : appeal.status === 'REJECTED' ? 'error' : 'orange'}>
                      {appeal.status.replaceAll('_', ' ')}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-brand-muted" aria-hidden="true" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <div className="mt-4 rounded-2xl border border-brand-charcoal/15 bg-brand-cream/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-brand-muted">{d.trust.decide}</p>
                <h3 className="mt-1 font-display text-lg font-extrabold text-brand-charcoal">{selected.user_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs font-bold text-brand-muted underline underline-offset-4"
              >
                {d.common.close}
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-brand-line bg-white p-3">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">{d.trust.appealMessage}</p>
              <p className="mt-1 text-xs leading-5 text-brand-charcoal">{selected.message}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ['UNDER_REVIEW', d.trust.review],
                  ['APPROVED', d.trust.approve],
                  ['REJECTED', d.trust.reject],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDecision(value)}
                  aria-pressed={decision === value}
                  className={cn(
                    'rounded-full px-3.5 py-2 text-xs font-bold transition',
                    decision === value
                      ? value === 'APPROVED'
                        ? 'bg-brand-success text-white'
                        : value === 'REJECTED'
                          ? 'bg-brand-error text-white'
                          : 'bg-brand-charcoal text-white'
                      : 'border border-brand-line bg-white text-brand-muted',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <TextareaField
                label={d.trust.decisionReason}
                value={decisionReason}
                onChange={(event) => setDecisionReason(event.target.value)}
                className="min-h-20"
              />
            </div>

            {decisionError ? (
              <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-brand-error" role="alert">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {decisionError}
              </p>
            ) : null}

            <div className="mt-4">
              <Button type="button" onClick={() => void decide()} loading={saving} disabled={saving}>
                <Gavel className="h-4 w-4" aria-hidden="true" />
                {d.trust.decide}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

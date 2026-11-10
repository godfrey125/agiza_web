import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bike,
  Bot,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  Gavel,
  Globe2,
  Layers,
  Monitor,
  MousePointerClick,
  RefreshCw,
  Repeat2,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Tablet,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Eyebrow } from '../components/ui/Layout'
import { useI18n } from '../i18n'
import { adminCopy } from '../i18n/admin'
import { controlCopy } from '../i18n/control'
import {
  ApiError,
  fetchAdminDashboard,
  fetchAdminSummary,
  type AccountActionType,
  type AdminDashboardData,
  type AdminSummary,
  type AnalyticsDailyPoint,
} from '../lib/api'
import { cn, formatDateTime } from '../lib/utils'

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

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-TZ', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function Change({ value }: { value: number }) {
  const up = value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-bold',
        up ? 'text-brand-success' : 'text-brand-error',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  change,
  hint,
  vsPrevious,
  noPrevious,
  tone = 'orange',
}: {
  icon: LucideIcon
  label: string
  value: string
  change?: number | null
  hint?: string
  vsPrevious: string
  noPrevious: string
  tone?: 'orange' | 'dark' | 'success' | 'neutral'
}) {
  const toneClass = {
    orange: 'bg-brand-orange/10 text-brand-dark',
    dark: 'bg-brand-charcoal/10 text-brand-charcoal',
    success: 'bg-brand-success/10 text-brand-success',
    neutral: 'bg-brand-cream text-brand-muted',
  }[tone]

  return (
    <article className="surface-card min-w-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
            {label}
          </p>
          <p className="mt-3 font-display text-3xl font-extrabold tracking-[-0.05em] text-brand-charcoal">
            {value}
          </p>
        </div>
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', toneClass)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      {change !== undefined || hint ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[0.68rem] text-brand-muted">
          {change === null ? (
            <span>{noPrevious}</span>
          ) : change !== undefined ? (
            <>
              <Change value={change} />
              <span>{vsPrevious}</span>
            </>
          ) : null}
          {hint ? <span>{hint}</span> : null}
        </div>
      ) : null}
    </article>
  )
}

function Panel({
  title,
  body,
  action,
  children,
  className,
}: {
  title: string
  body: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('surface-card min-w-0 p-5 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-extrabold tracking-[-0.03em] text-brand-charcoal">
            {title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-brand-muted">{body}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-line bg-brand-cream/60 p-5 text-sm text-brand-muted">
      {children}
    </div>
  )
}

function TrafficChart({
  data,
  viewsLabel,
  visitorsLabel,
  emptyLabel,
}: {
  data: AnalyticsDailyPoint[]
  viewsLabel: string
  visitorsLabel: string
  emptyLabel: string
}) {
  const max = Math.max(1, ...data.map((point) => point.views))
  const hasTraffic = data.some((point) => point.views > 0 || point.visitors > 0)

  if (!data.length || !hasTraffic) {
    return <EmptyNote>{emptyLabel}</EmptyNote>
  }

  return (
    <div>
      <div className="flex h-56 items-end gap-1 overflow-x-auto pb-2">
        {data.map((point) => (
          <div
            key={point.date}
            className="group flex h-full min-w-[7px] flex-1 flex-col justify-end"
            title={`${point.date}: ${formatNumber(point.views)} ${viewsLabel}, ${formatNumber(point.visitors)} ${visitorsLabel}`}
          >
            <div className="flex h-full items-end justify-center gap-[2px]">
              <span
                className="w-1/2 rounded-t-full bg-brand-orange/80 transition group-hover:bg-brand-orange"
                style={{ height: `${Math.max(2, (point.views / max) * 100)}%` }}
              />
              <span
                className="w-1/2 rounded-t-full bg-brand-charcoal/70 transition group-hover:bg-brand-charcoal"
                style={{ height: `${Math.max(2, (point.visitors / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[0.68rem] text-brand-muted">
        <span>{formatShortDate(data[0].date)}</span>
        <span>{formatShortDate(data[data.length - 1].date)}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-brand-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-orange" aria-hidden="true" />
          {viewsLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-charcoal" aria-hidden="true" />
          {visitorsLabel}
        </span>
      </div>
    </div>
  )
}

function ProgressRow({
  label,
  value,
  meta,
  max,
  unit,
  icon,
}: {
  label: string
  value: number
  meta: string
  max: number
  unit: string
  icon?: ReactNode
}) {
  const percent = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-brand-charcoal" title={label}>
              {label}
            </p>
            <p className="truncate text-[0.62rem] text-brand-muted">{meta}</p>
          </div>
        </div>
        <span className="shrink-0 text-right text-xs font-bold tabular-nums text-brand-charcoal">
          {formatNumber(value)}{' '}
          <span className="font-normal text-brand-muted">{unit}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-cream">
        <div className="h-full rounded-full bg-brand-orange" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-brand-line bg-brand-cream/50 p-3.5">
      <div className="flex items-center gap-2 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">
        <Icon className="h-3.5 w-3.5 text-brand-dark" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 font-display text-xl font-extrabold tracking-[-0.03em] text-brand-charcoal">
        {value}
      </p>
    </div>
  )
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="surface-card animate-pulse p-5">
          <div className="h-3 w-24 rounded-full bg-brand-line" />
          <div className="mt-4 h-8 w-20 rounded-full bg-brand-line" />
          <div className="mt-4 h-3 w-32 rounded-full bg-brand-line" />
        </div>
      ))}
    </div>
  )
}

function DeviceIcon({ device }: { device: string }) {
  const Icon = device === 'mobile' ? Smartphone : device === 'tablet' ? Tablet : device === 'bot' ? Bot : Monitor
  return <Icon className="h-3.5 w-3.5 shrink-0 text-brand-dark" aria-hidden="true" />
}

export function AdminDashboard() {
  const { lang } = useI18n()
  const d = adminCopy[lang]
  const c = controlCopy[lang]
  const [days, setDays] = useState<number>(7)
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetchAdminDashboard(days)
      setData(response)
      try {
        const governance = await fetchAdminSummary()
        setSummary(governance)
      } catch {
        setSummary(null)
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setError(d.page.errorBody)
      } else {
        setError(cause instanceof Error ? cause.message : d.page.errorBody)
      }
    } finally {
      setLoading(false)
    }
  }, [days, d.page.errorBody])

  useEffect(() => {
    void load()
  }, [load])

  const rangeOptions = useMemo(
    () => [
      { value: 1, label: d.page.range.day },
      { value: 7, label: d.page.range.week },
      { value: 30, label: d.page.range.month },
      { value: 90, label: d.page.range.quarter },
    ],
    [d],
  )

  const deviceLabels: Record<string, string> = {
    mobile: d.devices.mobile,
    tablet: d.devices.tablet,
    desktop: d.devices.desktop,
    bot: d.devices.bot,
    unknown: d.devices.unknown,
  }

  const topPageMax = Math.max(1, ...(data?.top_pages.map((row) => row.views) || []))
  const topSourceMax = Math.max(1, ...(data?.top_sources.map((row) => row.views) || []))
  const browserMax = Math.max(1, ...(data?.browsers.map((row) => row.views) || []))
  const deviceMax = Math.max(1, ...(data?.devices.map((row) => row.views) || []))
  const riskMax = Math.max(1, ...Object.values(summary?.risk || { low: 1 }))

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <Eyebrow>{d.page.eyebrow}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-[2.2rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[2.8rem]">
            {d.page.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">{d.page.lead}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {data ? (
              <Badge tone="success">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-success" aria-hidden="true" />
                {d.page.live}
              </Badge>
            ) : null}
            {data ? (
              <span className="text-[0.68rem] text-brand-muted">
                {d.page.updated} {formatDateTime(data.generated_at)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap items-center gap-1 rounded-full border border-brand-line bg-white p-1"
            role="group"
            aria-label={d.page.rangeLabel}
          >
            {rangeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDays(option.value)}
                aria-pressed={days === option.value}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[0.68rem] font-bold transition',
                  days === option.value
                    ? 'bg-brand-charcoal text-white'
                    : 'text-brand-muted hover:bg-brand-cream hover:text-brand-charcoal',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            loading={loading}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {d.page.refresh}
          </Button>
        </div>
      </header>

      <p className="mt-4 flex items-start gap-2 text-[0.68rem] leading-5 text-brand-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-dark" aria-hidden="true" />
        {d.page.note}
      </p>

      {error ? (
        <Alert tone="error" title={d.page.errorTitle} className="mt-5">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 inline-flex items-center gap-1.5 font-bold text-brand-dark underline underline-offset-4"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {d.page.retry}
          </button>
        </Alert>
      ) : null}

      <div className="mt-6">
        {loading && !data ? (
          <LoadingGrid />
        ) : data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={d.page.title}>
              <MetricCard
                icon={Users}
                label={d.kpi.uniqueVisitors}
                value={formatNumber(data.overview.unique_visitors)}
                change={data.overview.unique_visitors_change}
                vsPrevious={d.kpi.vsPrevious}
                noPrevious={d.kpi.noPrevious}
              />
              <MetricCard
                icon={MousePointerClick}
                label={d.kpi.pageViews}
                value={formatNumber(data.overview.page_views)}
                change={data.overview.page_views_change}
                vsPrevious={d.kpi.vsPrevious}
                noPrevious={d.kpi.noPrevious}
                tone="dark"
              />
              <MetricCard
                icon={Layers}
                label={d.kpi.sessions}
                value={formatNumber(data.overview.sessions)}
                change={data.overview.sessions_change}
                vsPrevious={d.kpi.vsPrevious}
                noPrevious={d.kpi.noPrevious}
                tone="neutral"
              />
              <MetricCard
                icon={UserCheck}
                label={d.kpi.loggedIn}
                value={formatNumber(data.overview.logged_in_visitors)}
                change={data.overview.logged_in_visitors_change}
                vsPrevious={d.kpi.vsPrevious}
                noPrevious={d.kpi.noPrevious}
                tone="success"
              />
              <MetricCard
                icon={UserPlus}
                label={d.kpi.newVisitors}
                value={formatNumber(data.overview.new_visitors)}
                vsPrevious={d.kpi.vsPrevious}
                noPrevious={d.kpi.noPrevious}
              />
              <MetricCard
                icon={Repeat2}
                label={d.kpi.returningVisitors}
                value={formatNumber(data.overview.returning_visitors)}
                vsPrevious={d.kpi.vsPrevious}
                noPrevious={d.kpi.noPrevious}
                tone="neutral"
              />
              <MetricCard
                icon={Activity}
                label={d.kpi.activeNow}
                value={formatNumber(data.overview.active_now)}
                hint={d.kpi.fiveMinutes}
                vsPrevious={d.kpi.vsPrevious}
                noPrevious={d.kpi.noPrevious}
                tone="success"
              />
              <MetricCard
                icon={Bot}
                label={d.kpi.botsFiltered}
                value={formatNumber(data.overview.bot_page_views)}
                vsPrevious={d.kpi.vsPrevious}
                noPrevious={d.kpi.noPrevious}
                tone="neutral"
              />
            </section>

            {summary ? (
              <section className="mt-5">
                <Panel
                  title={c.trust.title}
                  body={c.trust.lead}
                  action={
                    <Link
                      to="/admin/trust"
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-dark underline underline-offset-4"
                    >
                      {c.nav.trust}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  }
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniStat icon={Gavel} label={c.trust.totalActions} value={formatNumber(summary.governance.total_actions)} />
                    <MiniStat icon={ShieldAlert} label={c.trust.actions7d} value={formatNumber(summary.governance.actions_7d)} />
                    <MiniStat icon={UserX} label={c.trust.investigations} value={formatNumber(summary.governance.open_investigations)} />
                    <MiniStat icon={Clock3} label={c.trust.appeals} value={formatNumber(summary.governance.pending_appeals)} />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniStat icon={ShieldAlert} label={c.trust.suspendedAccounts} value={formatNumber(summary.account_states.temporarily_suspended)} />
                    <MiniStat icon={ShieldAlert} label={c.trust.restrictedAccounts} value={formatNumber(summary.account_states.restricted)} />
                    <MiniStat icon={UserX} label={c.trust.terminatedAccounts} value={formatNumber(summary.account_states.terminated)} />
                    <MiniStat icon={ShieldCheck} label={c.states.PENDING_VERIFICATION} value={formatNumber(summary.account_states.pending_verification)} />
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                    <div>
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                        {c.trust.riskTitle}
                      </p>
                      <div className="mt-3 space-y-2.5">
                        {(Object.keys(c.risk) as Array<keyof typeof c.risk>).map((level) => {
                          const value = summary.risk[level.toLowerCase() as 'low' | 'medium' | 'high' | 'critical']
                          return (
                            <div key={level}>
                              <div className="flex items-center justify-between gap-2">
                                <Badge tone={level === 'CRITICAL' || level === 'HIGH' ? 'error' : level === 'MEDIUM' ? 'warning' : 'neutral'}>
                                  {c.risk[level]}
                                </Badge>
                                <span className="text-[0.68rem] font-bold tabular-nums text-brand-charcoal">{value}</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-cream">
                                <div
                                  className={cn(
                                    'h-full rounded-full',
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
                    </div>

                    <div>
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                        {c.trust.recentTitle}
                      </p>
                      {summary.recent_actions.length === 0 ? (
                        <p className="mt-3 rounded-2xl border border-dashed border-brand-line bg-brand-cream/50 p-3 text-xs text-brand-muted">
                          {c.trust.recentEmpty}
                        </p>
                      ) : (
                        <ul className="mt-1 divide-y divide-brand-line">
                          {summary.recent_actions.slice(0, 4).map((record) => (
                            <li key={record.id} className="py-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-bold text-brand-charcoal">
                                  {c.actionLabels[record.action as AccountActionType] || record.action_label}
                                </p>
                                <Badge tone="cream">{record.category_label}</Badge>
                              </div>
                              <p className="mt-0.5 line-clamp-1 text-[0.65rem] text-brand-muted">
                                {record.reason} · {record.actor_name}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to="/admin/users" className="inline-flex items-center gap-1.5 rounded-full bg-brand-charcoal px-3.5 py-2 text-xs font-bold text-white">
                      {c.nav.users}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                    <Link to="/admin/audit" className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-3.5 py-2 text-xs font-bold text-brand-charcoal">
                      {c.nav.audit}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                    <Link to="/admin/staff" className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-3.5 py-2 text-xs font-bold text-brand-charcoal">
                      {c.nav.staff}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </Panel>
              </section>
            ) : null}

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
              <Panel title={d.traffic.title} body={d.traffic.body}>
                <TrafficChart
                  data={data.daily}
                  viewsLabel={d.traffic.views}
                  visitorsLabel={d.traffic.visitors}
                  emptyLabel={d.traffic.noData}
                />
              </Panel>

              <Panel title={d.devices.title} body={d.devices.body}>
                {data.devices.length === 0 ? (
                  <EmptyNote>{d.devices.empty}</EmptyNote>
                ) : (
                  <div className="space-y-4">
                    {data.devices.map((row) => (
                      <ProgressRow
                        key={row.device}
                        label={deviceLabels[row.device] || row.device || d.devices.unknown}
                        value={row.views}
                        meta={`${formatNumber(row.visitors)} ${d.common.visitors}`}
                        max={deviceMax}
                        unit={d.common.views}
                        icon={<DeviceIcon device={row.device} />}
                      />
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <Panel title={d.topPages.title} body={d.topPages.body}>
                {data.top_pages.length === 0 ? (
                  <EmptyNote>{d.topPages.empty}</EmptyNote>
                ) : (
                  <div className="space-y-4">
                    {data.top_pages.map((row) => (
                      <ProgressRow
                        key={row.path}
                        label={row.path === '/' ? 'Home' : row.path}
                        value={row.views}
                        meta={`${formatNumber(row.visitors)} ${d.common.visitors}`}
                        max={topPageMax}
                        unit={d.common.views}
                        icon={<Eye className="h-3.5 w-3.5 shrink-0 text-brand-dark" aria-hidden="true" />}
                      />
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title={d.sources.title} body={d.sources.body}>
                {data.top_sources.length === 0 ? (
                  <EmptyNote>{d.sources.empty}</EmptyNote>
                ) : (
                  <div className="space-y-4">
                    {data.top_sources.map((row) => (
                      <ProgressRow
                        key={row.source}
                        label={row.source === 'Direct' ? d.sources.direct : row.source}
                        value={row.views}
                        meta={`${formatNumber(row.visitors)} ${d.common.visitors}`}
                        max={topSourceMax}
                        unit={d.common.views}
                        icon={<Globe2 className="h-3.5 w-3.5 shrink-0 text-brand-dark" aria-hidden="true" />}
                      />
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
              <Panel title={d.recent.title} body={d.recent.body}>
                {data.recent_visits.length === 0 ? (
                  <EmptyNote>{d.recent.empty}</EmptyNote>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-brand-line text-[0.6rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                          <th className="pb-2 pr-4 font-bold">{d.recent.path}</th>
                          <th className="pb-2 pr-4 font-bold">{d.recent.visitor}</th>
                          <th className="pb-2 pr-4 font-bold">{d.recent.source}</th>
                          <th className="pb-2 pr-4 font-bold">{d.recent.device}</th>
                          <th className="pb-2 font-bold">{d.recent.time}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-line">
                        {data.recent_visits.map((visit, index) => (
                          <tr key={`${visit.time}-${visit.path}-${index}`} className="text-xs">
                            <td className="max-w-[220px] truncate py-2.5 pr-4 font-semibold text-brand-charcoal" title={visit.path}>
                              {visit.path}
                            </td>
                            <td className="py-2.5 pr-4 text-brand-muted">
                              {visit.visitor === 'Guest' ? d.recent.guest : visit.visitor}
                            </td>
                            <td className="py-2.5 pr-4 text-brand-muted">
                              {visit.source === 'Direct' ? d.sources.direct : visit.source}
                            </td>
                            <td className="py-2.5 pr-4 text-brand-muted">
                              {deviceLabels[visit.device] || visit.device}
                            </td>
                            <td className="whitespace-nowrap py-2.5 text-brand-muted">
                              {formatDateTime(visit.time)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel title={d.browsers.title} body={d.browsers.body} action={<BarChart3 className="h-5 w-5 text-brand-muted" aria-hidden="true" />}>
                {data.browsers.length === 0 ? (
                  <EmptyNote>{d.browsers.empty}</EmptyNote>
                ) : (
                  <div className="space-y-4">
                    {data.browsers.map((row) => (
                      <ProgressRow
                        key={row.browser}
                        label={row.browser || d.devices.unknown}
                        value={row.views}
                        meta={`${formatNumber(row.visitors)} ${d.common.visitors}`}
                        max={browserMax}
                        unit={d.common.views}
                        icon={<Monitor className="h-3.5 w-3.5 shrink-0 text-brand-dark" aria-hidden="true" />}
                      />
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <section className="mt-5">
              <Panel title={d.platform.title} body={d.platform.body}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <MiniStat icon={Users} label={d.platform.totalUsers} value={formatNumber(data.platform.total_users)} />
                  <MiniStat icon={UserPlus} label={d.platform.newUsers} value={formatNumber(data.platform.new_users)} />
                  <MiniStat icon={Users} label={d.platform.customers} value={formatNumber(data.platform.customers)} />
                  <MiniStat icon={Store} label={d.platform.vendors} value={formatNumber(data.platform.vendors)} />
                  <MiniStat icon={Bike} label={d.platform.riders} value={formatNumber(data.platform.riders)} />
                  <MiniStat icon={ShieldCheck} label={d.platform.admins} value={formatNumber(data.platform.admins)} />
                  <MiniStat icon={ShoppingBag} label={d.platform.totalOrders} value={formatNumber(data.platform.total_orders)} />
                  <MiniStat icon={Clock3} label={d.platform.ordersInRange} value={formatNumber(data.platform.orders_in_range)} />
                  <MiniStat icon={AlertCircle} label={d.platform.pendingOrders} value={formatNumber(data.platform.pending_orders)} />
                  <MiniStat icon={Wallet} label={d.platform.orderValue} value={formatTZS(data.platform.order_value_in_range)} />
                  <MiniStat icon={Store} label={d.platform.vendorProfiles} value={formatNumber(data.platform.vendor_profiles)} />
                  <MiniStat icon={Bike} label={d.platform.riderProfiles} value={formatNumber(data.platform.rider_profiles)} />
                </div>
              </Panel>
            </section>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <Link
                to="/#get-the-app"
                className="surface-card group flex items-start justify-between gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand-charcoal/20"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-orange/10 text-brand-dark">
                    <Download className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-extrabold tracking-[-0.02em] text-brand-charcoal">
                      {d.apps.title}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-brand-muted">{d.apps.body}</p>
                  </div>
                </div>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-brand-muted transition group-hover:text-brand-dark" aria-hidden="true" />
              </Link>

              <Link
                to="/admin/applications"
                className="surface-card group flex items-start justify-between gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand-charcoal/20"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-success/10 text-brand-success">
                    <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-extrabold tracking-[-0.02em] text-brand-charcoal">
                      {d.applications.title}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-brand-muted">{d.applications.body}</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand-dark">
                      {d.applications.cta}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

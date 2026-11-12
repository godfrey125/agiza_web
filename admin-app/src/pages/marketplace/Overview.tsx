import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bike,
  Bot,
  Clock3,
  Eye,
  Gavel,
  Globe2,
  Monitor,
  MousePointerClick,
  Package,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Tablet,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Wallet,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingCards,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '../../components/ui'
import {
  cn,
  currency,
  formatDateTime,
  number,
  paymentTone,
  timeAgo,
} from '../../lib/format'
import {
  fetchAdminDashboard,
  fetchAdminSummary,
  fetchPlatformOverview,
  type AdminDashboardData,
  type AdminSummary,
  type PlatformOverview,
} from '../../lib/marketplace'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`
  return number(value)
}

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date)
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone = 'orange',
}: {
  icon: typeof Gavel
  label: string
  value: string
  tone?: 'orange' | 'green' | 'yellow' | 'blue' | 'red'
}) {
  const tones = {
    orange: 'bg-peach text-primary',
    green: 'bg-soft-green text-success',
    yellow: 'bg-soft-yellow text-[#9A7214]',
    blue: 'bg-[#EEF4FF] text-[#3569B4]',
    red: 'bg-soft-red text-coral',
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-[#fdfbf7] p-3">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
          {label}
        </p>
        <p className="mt-0.5 font-display text-lg font-extrabold tracking-[-0.03em] text-ink">
          {value}
        </p>
      </div>
    </div>
  )
}

function RankedList({
  title,
  description,
  rows,
  empty,
}: {
  title: string
  description: string
  rows: Array<{ label: string; views: number; visitors: number }>
  empty: string
}) {
  const max = Math.max(1, ...rows.map((row) => row.views))
  return (
    <SectionCard title={title} description={description}>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-[#fdfbf7] p-4 text-xs text-muted">
          {empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.slice(0, 8).map((row) => (
            <li key={row.label}>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs font-semibold text-ink">
                  {row.label || 'Direct'}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted">
                  {number(row.views)} views · {number(row.visitors)} visitors
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f2ede6]">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(3, Math.round((row.views / max) * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

export default function MarketplaceOverview() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [operations, setOperations] = useState<PlatformOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dashboard, governance, ops] = await Promise.all([
        fetchAdminDashboard(days),
        fetchAdminSummary(),
        fetchPlatformOverview(days).catch(() => null),
      ])
      setData(dashboard)
      setSummary(governance)
      setOperations(ops)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The marketplace overview could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const chartData = useMemo(
    () =>
      (data?.daily || []).map((point) => ({
        ...point,
        label: shortDate(point.date),
      })),
    [data],
  )

  const operationsChart = useMemo(
    () =>
      (operations?.daily || []).map((point) => ({
        ...point,
        label: shortDate(point.date),
      })),
    [operations],
  )

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Marketplace"
          title="Platform overview"
          description="Website traffic, marketplace activity and governance at a glance."
        />
        <LoadingCards count={4} />
        <div className="skeleton h-[320px] rounded-2xl" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Marketplace" title="Platform overview" />
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  const overview = data?.overview
  const platform = data?.platform
  const statusTotal =
    (operations?.status_breakdown || []).reduce((sum, row) => sum + row.count, 0) || 1

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Marketplace"
        title="Platform overview"
        description="Website traffic, marketplace activity and governance at a glance. Every number comes from the live Django API."
        actions={
          <>
            <div className="flex rounded-xl border border-line bg-white p-1 shadow-soft">
              {RANGES.map((range) => (
                <button
                  key={range.days}
                  type="button"
                  onClick={() => setDays(range.days)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    days === range.days
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted hover:bg-[#fbf7f1] hover:text-ink',
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
              <RefreshCw size={13} />
              Refresh
            </Button>
          </>
        }
      />

      {error ? (
        <p className="flex items-start gap-1.5 rounded-xl border border-[#f4d7d2] bg-soft-red px-4 py-3 text-xs text-coral">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          Live marketplace
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Orders today"
          value={number(operations?.orders.today || 0)}
          icon={<ShoppingBag size={17} />}
          tone="orange"
          hint={`${number(operations?.orders.in_progress || 0)} in progress · ${number(operations?.orders.pending || 0)} waiting`}
        />
        <StatCard
          label="GMV today"
          value={currency(operations?.orders.gmv_today)}
          icon={<Wallet size={17} />}
          tone="green"
          hint={`${currency(operations?.orders.avg_order_value)} average order`}
        />
        <StatCard
          label="Riders online"
          value={number(operations?.riders.online || 0)}
          icon={<Bike size={17} />}
          tone="blue"
          hint={`${number(operations?.riders.active_jobs || 0)} active delivery jobs`}
        />
        <StatCard
          label="Vendors online"
          value={number(operations?.vendors.online || 0)}
          icon={<Store size={17} />}
          tone="yellow"
          hint={`${number(operations?.vendors.approved || 0)} approved · ${number(operations?.vendors.pending || 0)} pending`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SectionCard
          title="Order movement"
          description={`Orders placed and gross merchandise value over the last ${operations?.range_days || days} days.`}
        >
          {operationsChart.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag size={22} />}
              title="No orders in this range"
              message="Live order movement appears here as soon as the marketplace receives orders."
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={operationsChart} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="4 5" stroke="#F3EFE8" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis
                  yAxisId="orders"
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="gmv"
                  orientation="right"
                  tickFormatter={(value) => compact(Number(value))}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #EEE9E2', fontSize: 12 }}
                  formatter={(value, name) =>
                    name === 'GMV' ? currency(Number(value ?? 0)) : number(Number(value ?? 0))
                  }
                />
                <Legend verticalAlign="top" align="right" height={28} iconType="circle" iconSize={8} />
                <Bar
                  yAxisId="orders"
                  dataKey="orders"
                  name="Orders"
                  fill="#F05A32"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={26}
                />
                <Line
                  yAxisId="gmv"
                  type="monotone"
                  dataKey="gmv"
                  name="GMV"
                  stroke="#3569B4"
                  strokeWidth={2.4}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Order status mix" description="Where live orders sit right now.">
          {!operations?.status_breakdown?.length ? (
            <p className="rounded-xl border border-dashed border-line bg-[#fdfbf7] p-4 text-xs text-muted">
              No orders in this range yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {operations.status_breakdown.slice(0, 9).map((row) => (
                <li key={row.status}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-xs font-semibold text-ink">{row.label}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted">
                      {number(row.count)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f2ede6]">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max(
                          3,
                          Math.round((row.count / statusTotal) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SectionCard
          title="Recent orders"
          description="The latest orders across the marketplace."
          bodyClassName="p-0"
          action={
            <Link
              to="/marketplace/orders"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Open orders <ArrowUpRight size={12} />
            </Link>
          }
        >
          {!operations?.recent_orders?.length ? (
            <p className="px-5 py-10 text-center text-xs text-muted">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Vendor</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.recent_orders.slice(0, 8).map((order) => (
                    <tr key={order.id}>
                      <td className="font-semibold text-ink">{order.code}</td>
                      <td className="max-w-[150px] truncate">{order.customer_name || '—'}</td>
                      <td className="max-w-[160px] truncate">{order.vendor_name || '—'}</td>
                      <td className="font-semibold tabular-nums text-ink">
                        {currency(order.total)}
                      </td>
                      <td>
                        <Badge className={paymentTone(order.payment_status)}>
                          {order.payment_status_label}
                        </Badge>
                      </td>
                      <td><StatusBadge status={order.status} /></td>
                      <td
                        className="whitespace-nowrap text-muted"
                        title={formatDateTime(order.created_at)}
                      >
                        {timeAgo(order.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Top vendors" description="Revenue in this range.">
            {!operations?.top_vendors?.length ? (
              <p className="rounded-xl border border-dashed border-line bg-[#fdfbf7] p-4 text-xs text-muted">
                No vendor sales in this range.
              </p>
            ) : (
              <ul className="space-y-3">
                {operations.top_vendors.slice(0, 5).map((vendor, index) => (
                  <li key={vendor.id} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#f6f1e9] text-[10px] font-bold text-muted">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink">{vendor.name}</p>
                      <p className="text-[10px] text-muted">{number(vendor.orders)} orders</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-ink">
                      {currency(vendor.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Top riders" description="Completed deliveries in this range.">
            {!operations?.top_riders?.length ? (
              <p className="rounded-xl border border-dashed border-line bg-[#fdfbf7] p-4 text-xs text-muted">
                No completed deliveries in this range.
              </p>
            ) : (
              <ul className="space-y-3">
                {operations.top_riders.slice(0, 5).map((rider, index) => (
                  <li key={rider.id} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#f6f1e9] text-[10px] font-bold text-muted">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink">{rider.name}</p>
                      <p className="text-[10px] text-muted">{number(rider.deliveries)} deliveries</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-ink">
                      {currency(rider.earnings)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Top food items"
        description="The dishes moving fastest across all vendors."
        bodyClassName="p-0"
      >
        {!operations?.top_items?.length ? (
          <p className="px-5 py-10 text-center text-xs text-muted">No food sales in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Vendor</th>
                  <th>Orders</th>
                  <th>Quantity sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {operations.top_items.slice(0, 10).map((item) => (
                  <tr key={`${item.name}-${item.vendor}`}>
                    <td className="font-semibold text-ink">
                      <span className="inline-flex items-center gap-1.5">
                        <Package size={13} className="text-muted" />
                        {item.name}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate">{item.vendor || '—'}</td>
                    <td className="tabular-nums">{number(item.orders)}</td>
                    <td className="tabular-nums">{number(item.quantity)}</td>
                    <td className="font-semibold tabular-nums text-ink">
                      {currency(item.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          Website & governance
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Page views"
          value={compact(overview?.page_views || 0)}
          change={overview?.page_views_change ?? undefined}
          icon={<Eye size={17} />}
          tone="orange"
          hint={`${number(overview?.all_time_page_views || 0)} all time`}
        />
        <StatCard
          label="Unique visitors"
          value={compact(overview?.unique_visitors || 0)}
          change={overview?.unique_visitors_change ?? undefined}
          icon={<Users size={17} />}
          tone="blue"
          hint={`${number(overview?.new_visitors || 0)} new · ${number(overview?.returning_visitors || 0)} returning`}
        />
        <StatCard
          label="Sessions"
          value={compact(overview?.sessions || 0)}
          change={overview?.sessions_change ?? undefined}
          icon={<Activity size={17} />}
          tone="green"
          hint={`${number(overview?.active_now || 0)} active now`}
        />
        <StatCard
          label="Signed-in visitors"
          value={compact(overview?.logged_in_visitors || 0)}
          change={overview?.logged_in_visitors_change ?? undefined}
          icon={<UserCheck size={17} />}
          tone="yellow"
          hint={`${number(overview?.bot_page_views || 0)} bot views filtered`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SectionCard
          title="Traffic trend"
          description={`Page views and unique visitors over the last ${data?.range_days || days} days.`}
        >
          {chartData.length === 0 ? (
            <EmptyState
              icon={<Activity size={22} />}
              title="No traffic in this range"
              message="Visitor analytics appear here as soon as the website receives traffic."
            />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F05A32" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#F05A32" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3569B4" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#3569B4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 5" stroke="#F3EFE8" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={26} />
                <YAxis tickFormatter={(value) => compact(Number(value))} tickLine={false} axisLine={false} width={46} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #EEE9E2', fontSize: 12 }}
                  formatter={(value) => number(Number(value ?? 0))}
                />
                <Legend verticalAlign="top" align="right" height={28} iconType="circle" iconSize={8} />
                <Area
                  type="monotone"
                  dataKey="views"
                  name="Page views"
                  stroke="#F05A32"
                  strokeWidth={2.4}
                  fill="url(#viewsFill)"
                />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  name="Visitors"
                  stroke="#3569B4"
                  strokeWidth={2.2}
                  fill="url(#visitorsFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Traffic quality" description="What the range includes.">
          <div className="grid gap-3">
            <MiniStat icon={Globe2} label="All-time page views" value={number(overview?.all_time_page_views || 0)} />
            <MiniStat icon={Users} label="All-time visitors" value={number(overview?.all_time_unique_visitors || 0)} tone="blue" />
            <MiniStat icon={UserPlus} label="New visitors" value={number(overview?.new_visitors || 0)} tone="green" />
            <MiniStat icon={Activity} label="Returning visitors" value={number(overview?.returning_visitors || 0)} tone="yellow" />
            <MiniStat icon={Bot} label="Bot page views" value={number(overview?.bot_page_views || 0)} tone="red" />
            <MiniStat icon={ShieldCheck} label="Staff page views" value={number(overview?.staff_page_views || 0)} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RankedList
          title="Top pages"
          description="Most visited public pages in this range."
          rows={(data?.top_pages || []).map((row) => ({
            label: row.path,
            views: row.views,
            visitors: row.visitors,
          }))}
          empty="No page views recorded in this range."
        />
        <RankedList
          title="Traffic sources"
          description="Where visitors came from."
          rows={(data?.top_sources || []).map((row) => ({
            label: row.source,
            views: row.views,
            visitors: row.visitors,
          }))}
          empty="No referral sources recorded in this range."
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RankedList
          title="Devices"
          description="Desktop, mobile and tablet share."
          rows={(data?.devices || []).map((row) => ({
            label: row.device,
            views: row.views,
            visitors: row.visitors,
          }))}
          empty="No device data recorded in this range."
        />
        <RankedList
          title="Browsers"
          description="Browsers used by visitors."
          rows={(data?.browsers || []).map((row) => ({
            label: row.browser,
            views: row.views,
            visitors: row.visitors,
          }))}
          empty="No browser data recorded in this range."
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <SectionCard
          title="Governance snapshot"
          description="Account states and trust & safety workload."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat icon={Gavel} label="Actions recorded" value={number(summary?.governance.total_actions || 0)} />
            <MiniStat icon={ShieldAlert} label="Actions this week" value={number(summary?.governance.actions_7d || 0)} tone="yellow" />
            <MiniStat icon={UserX} label="Open investigations" value={number(summary?.governance.open_investigations || 0)} tone="red" />
            <MiniStat icon={Clock3} label="Pending appeals" value={number(summary?.governance.pending_appeals || 0)} tone="blue" />
            <MiniStat icon={ShieldAlert} label="Suspended accounts" value={number(summary?.account_states.temporarily_suspended || 0)} tone="yellow" />
            <MiniStat icon={ShieldAlert} label="Restricted accounts" value={number(summary?.account_states.restricted || 0)} tone="orange" />
            <MiniStat icon={UserX} label="Terminated accounts" value={number(summary?.account_states.terminated || 0)} tone="red" />
            <MiniStat icon={ShieldCheck} label="Pending verification" value={number(summary?.account_states.pending_verification || 0)} tone="green" />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-4">
            {(
              [
                ['Low', summary?.risk.low || 0, 'bg-success'],
                ['Medium', summary?.risk.medium || 0, 'bg-warning'],
                ['High', summary?.risk.high || 0, 'bg-coral'],
                ['Critical', summary?.risk.critical || 0, 'bg-ink'],
              ] as const
            ).map(([label, value, color]) => (
              <div key={label}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</span>
                  <span className="text-xs font-bold tabular-nums text-ink">{number(value)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f2ede6]">
                  <div
                    className={cn('h-full rounded-full', color)}
                    style={{
                      width: `${Math.max(
                        3,
                        Math.round(
                          (value /
                            Math.max(
                              1,
                              (summary?.risk.low || 0) +
                                (summary?.risk.medium || 0) +
                                (summary?.risk.high || 0) +
                                (summary?.risk.critical || 0),
                            )) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Marketplace activity" description="Accounts and orders in this range.">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat icon={Users} label="Total users" value={number(platform?.total_users || 0)} />
            <MiniStat icon={UserPlus} label="New users" value={number(platform?.new_users || 0)} tone="green" />
            <MiniStat icon={Users} label="Customers" value={number(platform?.customers || 0)} tone="blue" />
            <MiniStat icon={Store} label="Vendors" value={number(platform?.vendors || 0)} tone="yellow" />
            <MiniStat icon={Bike} label="Riders" value={number(platform?.riders || 0)} tone="green" />
            <MiniStat icon={ShieldCheck} label="Admins" value={number(platform?.admins || 0)} />
            <MiniStat icon={ShoppingBag} label="Total orders" value={number(platform?.total_orders || 0)} tone="blue" />
            <MiniStat icon={Clock3} label="Orders in range" value={number(platform?.orders_in_range || 0)} tone="yellow" />
            <MiniStat icon={AlertCircle} label="Pending orders" value={number(platform?.pending_orders || 0)} tone="red" />
            <MiniStat icon={Wallet} label="Order value" value={currency(platform?.order_value_in_range)} tone="green" />
            <MiniStat icon={Store} label="Vendor profiles" value={number(platform?.vendor_profiles || 0)} />
            <MiniStat icon={Bike} label="Rider profiles" value={number(platform?.rider_profiles || 0)} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SectionCard
          title="Recent visits"
          description="The latest page views on the public website."
          bodyClassName="p-0"
        >
          {!data?.recent_visits?.length ? (
            <p className="px-5 py-10 text-center text-xs text-muted">No visits recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[620px]">
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Visitor</th>
                    <th>Device</th>
                    <th>Source</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_visits.slice(0, 12).map((visit, index) => (
                    <tr key={`${visit.visitor}-${visit.time}-${index}`}>
                      <td className="max-w-[220px] truncate font-semibold text-ink">{visit.path}</td>
                      <td className="text-muted">{visit.visitor || 'Anonymous'}</td>
                      <td className="text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          {visit.device === 'mobile' ? (
                            <Smartphone size={13} />
                          ) : visit.device === 'tablet' ? (
                            <Tablet size={13} />
                          ) : (
                            <Monitor size={13} />
                          )}
                          {visit.device || '—'}
                        </span>
                      </td>
                      <td className="text-muted">{visit.source || 'Direct'}</td>
                      <td className="whitespace-nowrap text-muted">{timeAgo(visit.time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent enforcement" description="Latest governance actions.">
          {!summary?.recent_actions?.length ? (
            <p className="rounded-xl border border-dashed border-line bg-[#fdfbf7] p-4 text-xs text-muted">
              No enforcement actions recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {summary.recent_actions.slice(0, 8).map((record) => (
                <li key={record.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{record.action_label}</p>
                    <span className="badge-gray">{record.category_label}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{record.reason}</p>
                  <p className="mt-1 text-[10px] text-muted">
                    {record.actor_name} · {formatDateTime(record.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent audit trail" description="Append-only staff actions across the marketplace.">
        {!summary?.recent_audit?.length ? (
          <p className="rounded-xl border border-dashed border-line bg-[#fdfbf7] p-4 text-xs text-muted">
            No audit records yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {summary.recent_audit.slice(0, 8).map((record) => (
              <li key={record.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {record.target_label || record.target_id || 'System'}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {record.action} · {record.actor_name || 'System'}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] text-muted">{formatDateTime(record.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="flex items-center gap-2 text-[10px] text-muted">
        <MousePointerClick size={12} />
        Generated {data?.generated_at ? formatDateTime(data.generated_at) : '—'} · range{' '}
        {data?.range?.start ? formatDateTime(data.range.start) : '—'} to{' '}
        {data?.range?.end ? formatDateTime(data.range.end) : '—'}
      </div>
    </div>
  )
}

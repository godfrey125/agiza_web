import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Banknote, CalendarDays, ChefHat, Clock3, Plus, Receipt, RefreshCw,
  ShoppingBag, Sparkles, Tag, TrendingUp, UserPlus, UtensilsCrossed,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import type { DashboardData } from '../lib/types'
import { currency, formatTime, number, percent } from '../lib/format'
import {
  Button, ErrorState, FoodImage, LoadingCards, PageHeader, SectionCard, StatCard, StatusBadge,
} from '../components/ui'
import { CategoryDonut, RevenueTrendChart } from '../components/charts'

const ranges = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
]

const statusColors: Record<string, string> = {
  PENDING: 'bg-warning', CONFIRMED: 'bg-[#54A6C7]', PREPARING: 'bg-primary',
  READY: 'bg-[#8D7BC4]', COMPLETED: 'bg-success', CANCELLED: 'bg-coral',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [range, setRange] = useState('30d')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      const result = await api.get<DashboardData>(`/api/dashboard?range=${range}`)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [range])

  useEffect(() => { load() }, [load])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const revenueSpark = data?.series.map((point) => point.revenue) || []
  const ordersSpark = data?.series.map((point) => point.orders) || []
  const aovSpark = data?.series.map((point) => point.orders ? point.revenue / point.orders : 0) || []
  const topDish = data?.insights.bestDish
  const todayChange = data && data.insights.yesterday.revenue
    ? ((data.insights.today.revenue - data.insights.yesterday.revenue) / data.insights.yesterday.revenue) * 100
    : 0
  const statusOrder = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Dashboard' }]}
        eyebrow="Control center"
        title={`${greeting}, ${user?.name?.split(' ')[0] || 'there'}`}
        description="Here is how the restaurant is moving today — revenue, guests, kitchen flow and the dishes doing the heavy lifting."
        actions={(
          <>
            <div className="relative">
              <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <select value={range} onChange={(event) => setRange(event.target.value)} className="select h-10 w-[164px] pl-9 text-xs font-semibold">
                {ranges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <Button variant="secondary" icon={<RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />} onClick={() => load(false)} disabled={refreshing}>Refresh</Button>
            <Link to="/orders?new=1" className="btn-primary"><Plus size={15} /> New order</Link>
          </>
        )}
      />

      {loading ? (
        <div className="space-y-5">
          <LoadingCards />
          <div className="grid gap-5 xl:grid-cols-3">
            <div className="skeleton h-[356px] rounded-2xl xl:col-span-2" />
            <div className="skeleton h-[356px] rounded-2xl" />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="skeleton h-[360px] rounded-2xl" />
            <div className="skeleton h-[360px] rounded-2xl" />
          </div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : !data ? (
        <ErrorState message="The dashboard returned no data." onRetry={() => load()} />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total revenue"
              value={currency(data.summary.revenue.value)}
              change={data.summary.revenue.change}
              icon={<Banknote size={18} />}
              spark={revenueSpark}
              tone="orange"
              hint={`${number(data.summary.validOrders)} paid or payable orders`}
            />
            <StatCard
              label="Orders"
              value={number(data.summary.orders.value)}
              change={data.summary.orders.change}
              icon={<Receipt size={18} />}
              spark={ordersSpark}
              tone="yellow"
              hint={`${number(data.summary.completed)} completed in this range`}
            />
            <StatCard
              label="New customers"
              value={number(data.summary.newCustomers.value)}
              change={data.summary.newCustomers.change}
              icon={<UserPlus size={18} />}
              tone="green"
              hint="Guests added to the guest book"
            />
            <StatCard
              label="Average order"
              value={currency(data.summary.avgOrderValue.value)}
              change={data.summary.avgOrderValue.change}
              icon={<ShoppingBag size={18} />}
              spark={aovSpark}
              tone="blue"
              hint="Per non-cancelled order"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
            <SectionCard
              title="Revenue & orders trend"
              description={`${data.range.label} · compare daily takings against order volume`}
              action={<span className="badge-olive inline-flex rounded-full bg-[#fbf8f3] px-2.5 py-1 text-[10px] font-semibold text-muted">{percent(data.insights.revenueGrowth)} growth</span>}
            >
              {data.series.length ? (
                <RevenueTrendChart data={data.series} height={300} />
              ) : (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted">No orders in this period.</div>
              )}
            </SectionCard>

            <SectionCard title="Sales by category" description="Servings across the menu mix" action={<Link to="/analytics" className="text-xs font-semibold text-primary hover:underline">Analytics</Link>}>
              {data.categories.length ? <CategoryDonut data={data.categories} /> : (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted">No category sales yet.</div>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <SectionCard
              title="Top-selling dishes"
              description="The plates guests keep coming back for"
              action={<Link to="/menu" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">View menu <ArrowRight size={12} /></Link>}
              bodyClassName="pt-2"
            >
              {data.topDishes.length ? (
                <div className="divide-y divide-[#f5f1eb]">
                  {data.topDishes.map((dish, index) => (
                    <Link key={dish.id} to={`/menu/${dish.id}`} className="flex items-center gap-3 py-3 transition hover:opacity-80">
                      <span className="w-5 text-center font-display text-sm font-bold text-[#b9b0a5]">{String(index + 1).padStart(2, '0')}</span>
                      <FoodImage src={dish.imageUrl} alt={dish.name} className="h-11 w-11 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{dish.name}</p>
                        <p className="mt-0.5 text-xs text-muted">{number(dish.orders)} sold · {currency(dish.price)} menu price</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-ink">{currency(dish.revenue)}</p>
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                          {data.topDishes[0]?.orders ? `${Math.round((dish.orders / data.topDishes[0].orders) * 100)}% of leader` : '—'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted">Top dishes will appear after the first order.</div>
              )}
            </SectionCard>

            <SectionCard title="Order status" description="Where the kitchen is right now" action={<Link to="/orders" className="text-xs font-semibold text-primary hover:underline">All orders</Link>}>
              <div className="mb-4 flex items-center justify-between rounded-xl bg-[#fbf8f3] px-3.5 py-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">In the queue</p>
                  <p className="mt-0.5 font-display text-xl font-extrabold text-ink">{number(data.insights.today.orders)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Today's takings</p>
                  <p className="mt-0.5 font-display text-xl font-extrabold text-primary">{currency(data.insights.today.revenue)}</p>
                </div>
              </div>
              <div className="space-y-3.5">
                {statusOrder.map((status) => {
                  const row = data.status.find((item) => item.status === status)
                  return (
                    <div key={status}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <StatusBadge status={status} />
                        <span className="text-xs font-semibold text-ink">{number(row?.count || 0)} <span className="font-normal text-muted">({percent(row?.percent || 0, 0)})</span></span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#f2ede5]">
                        <div className={`h-full rounded-full ${statusColors[status] || 'bg-muted'}`} style={{ width: `${Math.max(row?.percent ? 3 : 0, row?.percent || 0)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-line px-3.5 py-3 text-xs">
                <span className="text-muted">Needs attention</span>
                <span className="font-semibold text-coral">{number(data.status.find((item) => item.status === 'CANCELLED')?.count || 0)} cancelled</span>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 text-primary"><Clock3 size={15} /><span className="text-[10px] font-bold uppercase tracking-[0.1em]">Peak hour</span></div>
              <p className="mt-2.5 font-display text-lg font-extrabold text-ink">{data.insights.peakHour ? formatTime(new Date(new Date().setHours(data.insights.peakHour.hour, 0, 0, 0))) : '—'}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{data.insights.peakHour ? `${data.insights.peakHour.orders} orders land in this service window.` : 'Waiting for enough order data.'}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-success"><Tag size={15} /><span className="text-[10px] font-bold uppercase tracking-[0.1em]">Leading category</span></div>
              <p className="mt-2.5 truncate font-display text-lg font-extrabold text-ink">{data.insights.bestCategory.name}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{currency(data.insights.bestCategory.revenue)} in category revenue.</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-[#9A7214]"><ChefHat size={15} /><span className="text-[10px] font-bold uppercase tracking-[0.1em]">Signature dish</span></div>
              <p className="mt-2.5 truncate font-display text-lg font-extrabold text-ink">{topDish?.name || '—'}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{topDish ? `${number(topDish.orders)} orders · ${currency(topDish.revenue)} revenue` : 'No signature dish yet.'}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-[#3569B4]"><TrendingUp size={15} /><span className="text-[10px] font-bold uppercase tracking-[0.1em]">Pace vs yesterday</span></div>
              <p className={`mt-2.5 font-display text-lg font-extrabold ${todayChange >= 0 ? 'text-success' : 'text-coral'}`}>{todayChange >= 0 ? '+' : ''}{todayChange.toFixed(1)}%</p>
              <p className="mt-1 text-xs leading-5 text-muted">{currency(data.insights.today.revenue)} today vs {currency(data.insights.yesterday.revenue)} yesterday.</p>
            </div>
          </div>

          <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-[#f2e3d8] bg-[linear-gradient(100deg,#FFF6EF,#FFFDF9)] p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white"><Sparkles size={16} /></span>
              <div>
                <p className="text-sm font-bold text-ink">Everything here is calculated from live records.</p>
                <p className="mt-0.5 text-xs leading-5 text-muted">No placeholder KPIs — the dashboard reads orders, guests, categories and menu performance directly from the workspace database.</p>
              </div>
            </div>
            <Link to="/reports" className="btn-secondary shrink-0 text-xs">Build a report <ArrowRight size={13} /></Link>
          </div>
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote, BarChart3, CalendarDays, Package, Percent, RefreshCw, TrendingUp, Users,
} from 'lucide-react'
import { api } from '../lib/api'
import { currency, number, percent } from '../lib/format'
import {
  ErrorState, PageHeader, SectionCard, Select, StatCard,
} from '../components/ui'
import {
  CategoryDonut, HorizontalBars, RevenueTrendChart, SimpleBarChart,
} from '../components/charts'

interface AnalyticsData {
  range: { label: string; start: string; end: string; key: string }
  summary: {
    revenue: { value: number; change: number }
    orders: { value: number; change: number }
    avgOrderValue: { value: number; change: number }
    grossProfit: { value: number; change: number }
    netProfit: { value: number; change: number }
    customerGrowth: { value: number; change: number }
    margin: number
  }
  profit: { revenue: number; cogs: number; operatingExpenses: number; grossProfit: number; netProfit: number; margin: number }
  series: { date: string; revenue: number; orders: number }[]
  newCustomerSeries: { date: string; customers: number }[]
  categories: { name: string; revenue: number; quantity: number }[]
  products: { id: number; name: string; imageUrl: string; price: number; quantity: number; revenue: number; cost: number }[]
  topProducts: { id: number; name: string; imageUrl: string; price: number; quantity: number; revenue: number; cost: number }[]
  byHour: { hour: number; orders: number; revenue: number }[]
  byWeekday: { weekday: number; orders: number; revenue: number }[]
  customers: {
    total: number
    newInRange: number
    returning: number
    retention: number
    topCustomers: { id: number; name: string; imageUrl: string; orders: number; spend: number }[]
  }
  inventory: {
    items: number
    value: number
    outOfStock: number
    lowStock: number
    usage: { id: number; name: string; unit: string; quantity: number; cost: number }[]
  }
  expenses: { category: string; amount: number }[]
}

const ranges = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
]

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AnalyticsPage() {
  const [range, setRange] = useState('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      const result = await api.get<AnalyticsData>(`/api/analytics?range=${range}`)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load analytics.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [range])

  useEffect(() => { load() }, [load])

  const hourly = data?.byHour.map((row) => ({ ...row, label: `${String(row.hour).padStart(2, '0')}:00` })) || []
  const weekday = data?.byWeekday.map((row) => ({ ...row, label: weekdayLabels[row.weekday] || `Day ${row.weekday}` })) || []
  const products = data?.products.filter((product) => product.quantity > 0) || []

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Analytics' }]}
        eyebrow="Performance lab"
        title="Analytics"
        description="Read the full picture — sales, profit, menu performance, guest behaviour, service hours and stock consumption."
        actions={(
          <>
            <div className="relative">
              <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <select value={range} onChange={(event) => setRange(event.target.value)} className="select h-10 w-[160px] pl-9 text-xs font-semibold">
                {ranges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => load(false)} className="btn-secondary" disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
          </>
        )}
      />

      {loading ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton h-[134px] rounded-2xl" />)}</div>
          <div className="skeleton h-[390px] rounded-2xl" />
          <div className="grid gap-5 xl:grid-cols-2"><div className="skeleton h-[340px] rounded-2xl" /><div className="skeleton h-[340px] rounded-2xl" /></div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : !data ? (
        <ErrorState message="No analytics data was returned." onRetry={() => load()} />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Revenue" value={currency(data.summary.revenue.value)} change={data.summary.revenue.change} icon={<Banknote size={18} />} spark={data.series.map((point) => point.revenue)} tone="orange" hint={data.range.label} />
            <StatCard label="Orders" value={number(data.summary.orders.value)} change={data.summary.orders.change} icon={<BarChart3 size={18} />} spark={data.series.map((point) => point.orders)} tone="yellow" hint="All order statuses" />
            <StatCard label="Average order" value={currency(data.summary.avgOrderValue.value)} change={data.summary.avgOrderValue.change} icon={<Banknote size={18} />} tone="blue" hint="Per non-cancelled order" />
            <StatCard label="Gross profit" value={currency(data.summary.grossProfit.value)} change={data.summary.grossProfit.change} icon={<TrendingUp size={18} />} tone="green" hint={`${percent(data.profit.margin)} net margin`} />
            <StatCard label="Net profit" value={currency(data.summary.netProfit.value)} change={data.summary.netProfit.change} icon={<Percent size={18} />} tone="orange" hint="After operating expenses" />
            <StatCard label="New customers" value={number(data.summary.customerGrowth.value)} change={data.summary.customerGrowth.change} icon={<Users size={18} />} tone="green" hint={`${data.customers.returning} returning guests`} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <SectionCard title="Revenue & orders" description={`${data.range.label} · daily performance`} action={<span className="badge-green">{percent(data.summary.revenue.change)} revenue change</span>}>
              {data.series.length ? <RevenueTrendChart data={data.series} height={320} /> : <div className="flex h-[320px] items-center justify-center text-sm text-muted">No orders in this period.</div>}
            </SectionCard>
            <SectionCard title="Profit breakdown" description="Where the money lands.">
              <div className="space-y-3">
                {[
                  ['Revenue', data.profit.revenue, 'text-ink', 'bg-primary'],
                  ['Cost of goods', -data.profit.cogs, 'text-coral', 'bg-[#E94B35]'],
                  ['Operating expenses', -data.profit.operatingExpenses, 'text-coral', 'bg-[#EAB544]'],
                  ['Gross profit', data.profit.grossProfit, 'text-success', 'bg-success'],
                  ['Net profit', data.profit.netProfit, 'text-success', 'bg-[#2F8C58]'],
                ].map(([label, value, tone, bar]) => {
                  const max = Math.max(data.profit.revenue, 1)
                  return (
                    <div key={String(label)}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="text-muted">{label as string}</span><span className={`font-semibold ${tone}`}>{currency(Math.abs(Number(value)))}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#f3eee7]"><div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(2, (Math.abs(Number(value)) / max) * 100)}%` }} /></div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 rounded-xl bg-[#fbf8f3] p-3 text-[11px] leading-5 text-muted">Margin is net profit divided by revenue. COGS uses menu cost prices; operating expenses come from the expense ledger.</div>
            </SectionCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <SectionCard title="Revenue by category" description="Menu mix by revenue.">
              {data.categories.length ? <CategoryDonut data={data.categories.map((item) => ({ name: item.name, value: item.revenue }))} valueMode="currency" /> : <div className="flex h-[260px] items-center justify-center text-sm text-muted">No category revenue.</div>}
            </SectionCard>
            <SectionCard title="Busiest hours" description="Order volume by hour of day.">
              {hourly.length ? <SimpleBarChart data={hourly} xKey="label" bars={[{ key: 'orders', label: 'Orders', color: '#EAB544' }]} height={280} /> : <div className="flex h-[280px] items-center justify-center text-sm text-muted">No hourly data.</div>}
            </SectionCard>
            <SectionCard title="Weekday rhythm" description="Which days carry service.">
              {weekday.length ? <SimpleBarChart data={weekday} xKey="label" bars={[{ key: 'revenue', label: 'Revenue', color: '#F05A32' }]} height={280} /> : <div className="flex h-[280px] items-center justify-center text-sm text-muted">No weekday data.</div>}
            </SectionCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
            <SectionCard title="Menu performance" description="Every dish ranked by units and revenue." bodyClassName="p-0" action={<Link to="/reports" className="text-xs font-semibold text-primary hover:underline">Build report</Link>}>
              {products.length ? (
                <div className="table-wrap rounded-none border-0">
                  <table className="data-table min-w-[660px]">
                    <thead><tr><th>Dish</th><th>Price</th><th>Sold</th><th>Revenue</th><th>Cost</th><th>Gross profit</th></tr></thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id}>
                          <td><Link to={`/menu/${product.id}`} className="font-semibold text-ink hover:text-primary">{product.name}</Link></td>
                          <td>{currency(product.price)}</td>
                          <td>{number(product.quantity)}</td>
                          <td className="font-semibold text-ink">{currency(product.revenue)}</td>
                          <td className="text-muted">{currency(product.cost)}</td>
                          <td><span className="font-semibold text-success">{currency(product.revenue - product.cost)}</span><span className="ml-1 text-[10px] text-muted">({percent(product.revenue ? ((product.revenue - product.cost) / product.revenue) * 100 : 0, 0)})</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="p-5 text-center text-sm text-muted">Menu performance appears after orders are recorded.</div>}
            </SectionCard>

            <SectionCard title="Top guests" description="Highest spend in this period." action={<Users size={17} className="text-primary" />}>
              {data.customers.topCustomers.length ? (
                <div className="space-y-3">
                  {data.customers.topCustomers.map((customer, index) => (
                    <Link key={customer.id} to={`/customers/${customer.id}`} className="flex items-center gap-3 rounded-xl border border-line p-2.5 transition hover:border-primary/30">
                      <span className="w-4 text-center font-display text-xs font-bold text-[#bbb2a6]">{index + 1}</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-ink">{customer.name}</p><p className="mt-0.5 text-[10px] text-muted">{customer.orders} orders</p></div>
                      <span className="text-xs font-bold text-primary">{currency(customer.spend)}</span>
                    </Link>
                  ))}
                </div>
              ) : <div className="py-8 text-center text-sm text-muted">No guest spend in this period.</div>}
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
                <div className="rounded-xl bg-[#fbf8f3] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Retention</p><p className="mt-1 font-display text-lg font-extrabold text-success">{percent(data.customers.retention, 0)}</p></div>
                <div className="rounded-xl bg-[#fbf8f3] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted">New in range</p><p className="mt-1 font-display text-lg font-extrabold text-ink">{number(data.customers.newInRange)}</p></div>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard title="Stock consumed by completed orders" description="Recipe usage generated from completed tickets." action={<Package size={17} className="text-primary" />}>
              {data.inventory.usage.length ? (
                <div className="space-y-2.5">
                  {data.inventory.usage.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                      <div><p className="text-xs font-semibold text-ink">{item.name}</p><p className="mt-0.5 text-[10px] text-muted">{number(item.quantity)} {item.unit} used</p></div>
                      <span className="text-xs font-bold text-primary">{currency(item.cost)}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="py-8 text-center text-sm text-muted">No completed-order consumption in this period.</div>}
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#fbf8f3] px-3.5 py-3 text-xs"><span className="text-muted">Stock value on hand</span><span className="font-bold text-ink">{currency(data.inventory.value)}</span></div>
            </SectionCard>

            <div className="space-y-5">
              <SectionCard title="Operating expenses" description="Expense mix for the selected period.">
                {data.expenses.length ? <HorizontalBars data={data.expenses.map((row) => ({ name: row.category, revenue: row.amount }))} /> : <div className="py-8 text-center text-sm text-muted">No expenses recorded in this period.</div>}
              </SectionCard>
              <div className="grid grid-cols-3 gap-3">
                <div className="card p-3.5"><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Low stock</p><p className="mt-1 font-display text-xl font-extrabold text-[#9A7214]">{number(data.inventory.lowStock)}</p></div>
                <div className="card p-3.5"><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Out of stock</p><p className="mt-1 font-display text-xl font-extrabold text-coral">{number(data.inventory.outOfStock)}</p></div>
                <div className="card p-3.5"><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Stock items</p><p className="mt-1 font-display text-xl font-extrabold text-ink">{number(data.inventory.items)}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

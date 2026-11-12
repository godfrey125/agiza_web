import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { compactNumber, currency, number } from '../lib/format'

const palette = ['#F05A32', '#EAB544', '#43A66A', '#E94B35', '#8D7BC4', '#54A6C7', '#E58D62', '#A6B4C8']

function shortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date)
}

function ChartTooltip({ active, payload, label, numberKeys = ['orders', 'quantity', 'count'] }: { active?: boolean; payload?: any[]; label?: string; numberKeys?: string[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="mb-1.5 font-semibold text-ink">{label ? (String(label).includes('T') ? shortDate(String(label)) : label) : ''}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.dataKey || item.name} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color || item.fill || '#F05A32' }} />
              {item.name}
            </span>
            <span className="font-semibold text-ink">
              {numberKeys.includes(String(item.dataKey))
                ? number(item.value)
                : currency(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RevenueTrendChart({ data, height = 300 }: { data: { date: string; revenue: number; orders: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F05A32" stopOpacity={.22} />
            <stop offset="100%" stopColor="#F05A32" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 5" stroke="#F3EFE8" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis yAxisId="revenue" tickFormatter={compactNumber} tickLine={false} axisLine={false} width={50} />
        <YAxis yAxisId="orders" orientation="right" tickLine={false} axisLine={false} width={38} />
        <Tooltip content={(props: any) => <ChartTooltip {...props} />} cursor={{ stroke: '#E6DED3', strokeDasharray: '4 4' }} />
        <Legend verticalAlign="top" align="right" height={28} iconType="circle" iconSize={8} />
        <Area yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke="#F05A32" strokeWidth={2.5} fill="url(#revenueFill)" activeDot={{ r: 4, fill: '#F05A32', stroke: '#fff', strokeWidth: 2 }} />
        <Line yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke="#EAB544" strokeWidth={2.2} dot={false} activeDot={{ r: 3.5, fill: '#EAB544', stroke: '#fff', strokeWidth: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function CategoryDonut({ data, height = 236, valueMode = 'number', centerLabel }: { data: { name: string; value: number }[]; height?: number; valueMode?: 'number' | 'currency'; centerLabel?: string }) {
  const total = data.reduce((sum, item) => sum + Number(item.value), 0)
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} stroke="none">
            {data.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}
          </Pie>
          <Tooltip content={(props: any) => <ChartTooltip {...props} numberKeys={valueMode === 'currency' ? ['orders', 'quantity', 'count'] : ['value', 'orders', 'quantity', 'count']} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-2">
        <span className="font-display text-2xl font-extrabold tracking-tight text-ink">{valueMode === 'currency' ? compactNumber(total) : number(total)}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{centerLabel || (valueMode === 'currency' ? 'revenue' : 'servings')}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 px-1">
        {data.map((item, index) => (
          <div key={item.name} className="flex min-w-0 items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: palette[index % palette.length] }} />
            <span className="truncate text-muted">{item.name}</span>
            <span className="ml-auto font-semibold text-ink">{total ? Math.round((item.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SimpleBarChart({ data, xKey, bars, height = 260 }: { data: Record<string, any>[]; xKey: string; bars: { key: string; label: string; color?: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="4 5" stroke="#F3EFE8" vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickFormatter={(value) => String(value).includes('T') ? shortDate(String(value)) : String(value)} minTickGap={12} />
        <YAxis tickFormatter={compactNumber} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={(props: any) => <ChartTooltip {...props} />} cursor={{ fill: '#FBF7F1' }} />
        <Legend verticalAlign="top" align="right" height={28} iconType="circle" iconSize={8} />
        {bars.map((bar) => <Bar key={bar.key} dataKey={bar.key} name={bar.label} fill={bar.color || '#F05A32'} radius={[5, 5, 0, 0]} maxBarSize={26} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function HorizontalBars({ data, valueKey = 'revenue', labelKey = 'name' }: { data: Record<string, any>[]; valueKey?: string; labelKey?: string }) {
  const max = Math.max(...data.map((item) => Number(item[valueKey]) || 0), 1)
  return (
    <div className="space-y-3.5">
      {data.map((item, index) => (
        <div key={`${item[labelKey]}-${index}`}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-[#5f5a53]">{item[labelKey]}</span>
            <span className="shrink-0 font-semibold text-ink">{currency(item[valueKey])}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#f4efe7]">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(4, (Number(item[valueKey]) / max) * 100)}%`, background: palette[index % palette.length] }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RatingDistribution({ data }: { data: { rating: number; count: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0)
  return (
    <div className="space-y-3">
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = data.find((item) => item.rating === rating)?.count || 0
        return (
          <div key={rating} className="flex items-center gap-3">
            <span className="w-3 text-xs font-semibold text-muted">{rating}</span>
            <span className="text-warning">★</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f4efe7]">
              <div className="h-full rounded-full bg-warning" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
            </div>
            <span className="w-8 text-right text-xs font-semibold text-ink">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ProfitTrendChart({ data, height = 250 }: { data: { date?: string; month?: string; revenue: number; net?: number; grossProfit?: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 5" stroke="#F3EFE8" vertical={false} />
        <XAxis dataKey={data[0]?.month ? 'month' : 'date'} tickFormatter={(value) => String(value).includes('T') ? shortDate(String(value)) : String(value)} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tickFormatter={compactNumber} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={(props: any) => <ChartTooltip {...props} />} />
        <Legend verticalAlign="top" align="right" height={28} iconType="circle" iconSize={8} />
        <Bar dataKey="revenue" name="Revenue" fill="#F8C4B1" radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Line type="monotone" dataKey="grossProfit" name="Gross profit" stroke="#43A66A" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="net" name="Net profit" stroke="#F05A32" strokeWidth={2.2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

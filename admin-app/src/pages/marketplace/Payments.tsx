import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  RotateCcw,
  Wallet,
} from 'lucide-react'
import {
  Badge,
  Button,
  DateRangeFields,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Pagination,
  SearchInput,
  SectionCard,
  Select,
  StatCard,
} from '../../components/ui'
import { currency, formatDateTime, number, paymentTone, timeAgo } from '../../lib/format'
import {
  fetchPlatformOverview,
  fetchPlatformPayments,
  type PlatformOverview,
  type PlatformPayment,
} from '../../lib/marketplace'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: 'all', label: 'All payment statuses' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
]

const METHOD_OPTIONS = [
  { value: 'all', label: 'All methods' },
  { value: 'CASH', label: 'Cash' },
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'TIGOPESA', label: 'Mixx by Yas' },
  { value: 'AIRTEL_MONEY', label: 'Airtel Money' },
  { value: 'HALOPESA', label: 'Halopesa' },
]

export default function MarketplacePayments() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [payments, setPayments] = useState<PlatformPayment[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('all')
  const [method, setMethod] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPlatformOverview(30)
      .then(setOverview)
      .catch(() => setOverview(null))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchPlatformPayments({
        q: debounced || undefined,
        status,
        method,
        from: from || undefined,
        to: to || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      setPayments(data.results)
      setCount(data.count)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Payments could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [debounced, status, method, from, to, page])

  useEffect(() => {
    void load()
  }, [load])

  const stats = overview?.payments

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Money movement"
        title="Payments"
        description="Every payment record raised against an order, with method, provider reference and settlement status."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCw size={13} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Payments in range"
          value={number(stats?.in_range || 0)}
          icon={<Wallet size={17} />}
          tone="orange"
          hint={`${number(stats?.total || 0)} total payment records`}
        />
        <StatCard
          label="Paid"
          value={currency(stats?.paid_amount)}
          icon={<CheckCircle2 size={17} />}
          tone="green"
          hint={`${number(stats?.paid || 0)} settled payments`}
        />
        <StatCard
          label="Pending"
          value={currency(stats?.pending_amount)}
          icon={<Clock3 size={17} />}
          tone="yellow"
          hint={`${number(stats?.pending || 0)} waiting for confirmation`}
        />
        <StatCard
          label="Failed / refunded"
          value={currency(
            Number(stats?.failed_amount || 0) + Number(stats?.refunded_amount || 0),
          )}
          icon={<AlertTriangle size={17} />}
          tone="orange"
          hint={`${number(stats?.failed || 0)} failed · ${number(stats?.refunded || 0)} refunded`}
        />
      </div>

      <SectionCard
        title="Payment ledger"
        description="Search by order, payer, phone or provider reference. Dates filter on when the payment record was created."
        bodyClassName="p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search payments…" />
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              className="w-auto text-xs"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={method}
              onChange={(event) => {
                setMethod(event.target.value)
                setPage(1)
              }}
              className="w-auto text-xs"
            >
              {METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <DateRangeFields
              start={from}
              end={to}
              onStart={(value) => {
                setFrom(value)
                setPage(1)
              }}
              onEnd={(value) => {
                setTo(value)
                setPage(1)
              }}
            />
          </div>
        }
      >
        {error ? (
          <div className="p-5">
            <ErrorState message={error} onRetry={() => void load()} />
          </div>
        ) : loading && payments.length === 0 ? (
          <div className="p-5">
            <LoadingBlock rows={7} />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Wallet size={22} />}
              title="No payments match these filters"
              message="Payment records appear here as soon as an order starts a payment."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[980px]">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Payer</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Reference</th>
                    <th>Confirmed by</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <p className="font-semibold text-ink">{payment.order_code}</p>
                        <p className="text-[10px] text-muted">Order #{payment.order}</p>
                      </td>
                      <td>
                        <p className="text-xs font-medium text-ink">{payment.payer_name || '—'}</p>
                        <p className="text-[10px] text-muted">{payment.payer_phone || '—'}</p>
                      </td>
                      <td className="text-xs">{payment.method_label || payment.method}</td>
                      <td className="font-semibold tabular-nums text-ink">
                        {currency(payment.amount)}
                      </td>
                      <td>
                        <Badge className={paymentTone(payment.status)}>{payment.status_label}</Badge>
                      </td>
                      <td className="max-w-[180px] truncate text-xs text-muted">
                        {payment.provider_reference || '—'}
                      </td>
                      <td className="text-xs text-muted">
                        {payment.confirmed_by ? `#${payment.confirmed_by}` : '—'}
                      </td>
                      <td
                        className="whitespace-nowrap text-muted"
                        title={formatDateTime(payment.created_at)}
                      >
                        {timeAgo(payment.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count} onChange={setPage} />
          </>
        )}
      </SectionCard>

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-soft">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Unpaid</p>
            <p className="mt-1 font-display text-lg font-extrabold text-ink">
              {currency(stats.unpaid_amount)}
            </p>
            <p className="text-[11px] text-muted">{number(stats.unpaid)} orders</p>
          </div>
          <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-soft">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Refunded</p>
            <p className="mt-1 font-display text-lg font-extrabold text-ink">
              {currency(stats.refunded_amount)}
            </p>
            <p className="text-[11px] text-muted">{number(stats.refunded)} payments</p>
          </div>
          <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-soft">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Failed</p>
            <p className="mt-1 font-display text-lg font-extrabold text-ink">
              {currency(stats.failed_amount)}
            </p>
            <p className="text-[11px] text-muted">{number(stats.failed)} payments</p>
          </div>
        </div>
      ) : null}

      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <RotateCcw size={11} />
        Payments are read-only here. Refunds and settlement adjustments stay in the finance workflow.
      </p>
    </div>
  )
}

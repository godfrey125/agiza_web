import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Bike,
  Clock3,
  Eye,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  SectionCard,
  Select,
  StatCard,
} from '../../components/ui'
import {
  currency,
  formatDateTime,
  number,
  paymentTone,
  timeAgo,
  titleCase,
} from '../../lib/format'
import {
  fetchPlatformOrder,
  fetchPlatformOrders,
  fetchPlatformOverview,
  type PlatformOrder,
  type PlatformOrderDetail,
  type PlatformOverview,
} from '../../lib/marketplace'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Waiting for vendor' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'delivered', label: 'Delivered / completed' },
  { value: 'cancelled', label: 'Cancelled / rejected' },
  { value: 'PENDING_VENDOR_CONFIRMATION', label: 'Pending vendor confirmation' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY', label: 'Ready' },
  { value: 'AWAITING_RIDER', label: 'Waiting for rider' },
  { value: 'RIDER_ASSIGNED', label: 'Rider assigned' },
  { value: 'PICKED_UP', label: 'Picked up' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'All order types' },
  { value: 'DINE_IN', label: 'Dine-in' },
  { value: 'MENU_DELIVERY', label: 'Menu delivery' },
  { value: 'CUSTOM_DELIVERY', label: 'Custom delivery' },
]

const PAYMENT_OPTIONS = [
  { value: 'all', label: 'All payments' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
]

function orderTone(status: string) {
  if (['DELIVERED', 'COMPLETED'].includes(status)) return 'badge-green'
  if (['REJECTED', 'EXPIRED', 'CANCELLED'].includes(status)) return 'badge-red'
  if (status === 'PENDING_VENDOR_CONFIRMATION') return 'badge-yellow'
  if (
    ['ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'AWAITING_RIDER', 'RIDER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(
      status,
    )
  ) {
    return 'badge-blue'
  }
  return 'badge-gray'
}

export default function MarketplaceOrders() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [orders, setOrders] = useState<PlatformOrder[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('all')
  const [orderType, setOrderType] = useState('all')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [selected, setSelected] = useState<PlatformOrderDetail | null>(null)

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
      const data = await fetchPlatformOrders({
        q: debounced || undefined,
        status,
        order_type: orderType,
        payment_status: paymentStatus,
        page,
        page_size: PAGE_SIZE,
      })
      setOrders(data.results)
      setCount(data.count)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Orders could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [debounced, status, orderType, paymentStatus, page])

  useEffect(() => {
    void load()
  }, [load])

  const openOrder = async (order: PlatformOrder) => {
    setDetailOpen(true)
    setSelected(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      setSelected(await fetchPlatformOrder(order.id))
    } catch (cause) {
      setDetailError(
        cause instanceof Error ? cause.message : 'The order detail could not be loaded.',
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const stats = overview?.orders

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Live operations"
        title="Orders & food movement"
        description="Every order across dine-in, menu delivery and custom food requests — with vendor, rider, payment and status in one place."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCw size={13} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Orders today"
          value={number(stats?.today || 0)}
          icon={<ShoppingBag size={17} />}
          tone="orange"
          hint={`${number(stats?.in_range || 0)} in the last 30 days`}
        />
        <StatCard
          label="GMV today"
          value={currency(stats?.gmv_today)}
          icon={<Wallet size={17} />}
          tone="green"
          hint={`${currency(stats?.avg_order_value)} average order`}
        />
        <StatCard
          label="In progress"
          value={number(stats?.in_progress || 0)}
          icon={<Clock3 size={17} />}
          tone="blue"
          hint={`${number(stats?.pending || 0)} waiting for vendor`}
        />
        <StatCard
          label="Completion rate"
          value={`${Number(stats?.completion_rate || 0).toFixed(1)}%`}
          icon={<TrendingUp size={17} />}
          tone="yellow"
          hint={`${number(stats?.delivered || 0)} delivered · ${number(stats?.cancelled || 0)} cancelled`}
        />
      </div>

      <SectionCard
        title="Order stream"
        description="Search by order code, customer, vendor or rider. Click any row for the full timeline."
        bodyClassName="p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search orders…" />
            <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="w-auto text-xs">
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
            <Select value={orderType} onChange={(event) => { setOrderType(event.target.value); setPage(1) }} className="w-auto text-xs">
              {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
            <Select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1) }} className="w-auto text-xs">
              {PAYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </div>
        }
      >
        {error ? (
          <div className="p-5">
            <ErrorState message={error} onRetry={() => void load()} />
          </div>
        ) : loading && orders.length === 0 ? (
          <div className="p-5"><LoadingBlock rows={8} /></div>
        ) : orders.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<ShoppingBag size={22} />}
              title="No orders match these filters"
              message="Orders will appear here as soon as customers place them on the Agiza marketplace."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1050px]">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Vendor</th>
                    <th>Rider</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Placed</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} onClick={() => void openOrder(order)} className="cursor-pointer">
                      <td>
                        <p className="font-semibold text-ink">{order.code}</p>
                        <p className="text-[10px] text-muted">{order.order_type_label}</p>
                      </td>
                      <td>
                        <p className="font-medium text-ink">{order.customer_name || '—'}</p>
                        <p className="text-[10px] text-muted">{order.customer_phone || '—'}</p>
                      </td>
                      <td className="max-w-[180px] truncate">{order.vendor_name || '—'}</td>
                      <td>
                        {order.rider_name ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
                            <Bike size={13} className="text-muted" />
                            {order.rider_name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">Not assigned</span>
                        )}
                      </td>
                      <td className="tabular-nums">{number(order.item_count)}</td>
                      <td className="font-semibold tabular-nums text-ink">{currency(order.total)}</td>
                      <td><Badge className={paymentTone(order.payment_status)}>{order.payment_status_label}</Badge></td>
                      <td><Badge className={orderTone(order.status)}>{order.status_label}</Badge></td>
                      <td className="whitespace-nowrap text-muted" title={formatDateTime(order.created_at)}>{timeAgo(order.created_at)}</td>
                      <td>
                        <span className="icon-btn h-7 w-7" aria-hidden="true"><Eye size={13} /></span>
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

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected ? `Order ${selected.code}` : 'Order detail'}
        description={selected ? `${selected.order_type_label} · placed ${formatDateTime(selected.created_at)}` : 'Loading the order…'}
        width="max-w-4xl"
      >
        {detailLoading ? (
          <LoadingBlock rows={7} />
        ) : selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={orderTone(selected.status)}>{selected.status_label}</Badge>
              <Badge className={paymentTone(selected.payment_status)}>{selected.payment_status_label}</Badge>
              <Badge className="badge-gray">{selected.order_type_label}</Badge>
              <span className="ml-auto font-display text-xl font-extrabold tracking-[-0.03em] text-ink">
                {currency(selected.total)}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-line bg-[#fdfbf7] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Customer</p>
                <p className="mt-1 text-sm font-semibold text-ink">{selected.customer_name || '—'}</p>
                <p className="text-[11px] text-muted">{selected.customer_phone || selected.customer_email || '—'}</p>
              </div>
              <div className="rounded-xl border border-line bg-[#fdfbf7] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Vendor</p>
                <p className="mt-1 text-sm font-semibold text-ink">{selected.vendor_name || '—'}</p>
                <p className="text-[11px] text-muted">{selected.vendor_phone || selected.vendor_address || '—'}</p>
              </div>
              <div className="rounded-xl border border-line bg-[#fdfbf7] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Rider</p>
                <p className="mt-1 text-sm font-semibold text-ink">{selected.rider_name || 'Not assigned'}</p>
                <p className="text-[11px] text-muted">{selected.rider_phone || '—'}</p>
              </div>
              <div className="rounded-xl border border-line bg-[#fdfbf7] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Delivery</p>
                <p className="mt-1 text-sm font-semibold text-ink">{selected.delivery ? selected.delivery.status_label : 'No delivery job'}</p>
                <p className="text-[11px] text-muted">{selected.delivery_address || selected.delivery_landmark || '—'}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">Items</h3>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="data-table min-w-[520px]">
                  <thead>
                    <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Line total</th><th>Instructions</th></tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item) => (
                      <tr key={item.id}>
                        <td className="font-medium text-ink">{item.name}</td>
                        <td className="tabular-nums">{item.quantity}</td>
                        <td className="tabular-nums">{currency(item.unit_price)}</td>
                        <td className="font-semibold tabular-nums">{currency(item.line_total)}</td>
                        <td className="max-w-[200px] truncate text-muted">{item.instructions || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Money</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted">Subtotal</dt><dd className="font-medium tabular-nums">{currency(selected.subtotal)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">Discount</dt><dd className="font-medium tabular-nums">{currency(selected.discount_total)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">Delivery fee</dt><dd className="font-medium tabular-nums">{currency(selected.delivery_fee)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">Rider tip</dt><dd className="font-medium tabular-nums">{currency(selected.rider_tip)}</dd></div>
                  <div className="flex justify-between gap-3 border-t border-line pt-2"><dt className="font-semibold text-ink">Total</dt><dd className="font-bold tabular-nums text-ink">{currency(selected.total)}</dd></div>
                </dl>
              </div>
              <div className="rounded-xl border border-line p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Timeline</h3>
                {selected.history.length === 0 ? (
                  <p className="mt-3 text-xs text-muted">No status history recorded.</p>
                ) : (
                  <ol className="mt-3 space-y-2">
                    {selected.history.map((entry, index) => (
                      <li key={`${entry.created_at}-${index}`} className="flex gap-2 text-xs">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <div>
                          <p className="font-semibold text-ink">{titleCase(entry.to_status)}</p>
                          <p className="text-[10px] text-muted">{entry.actor_role || 'system'} · {formatDateTime(entry.created_at)}</p>
                          {entry.note ? <p className="text-[10px] text-muted">{entry.note}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            {selected.delivery ? (
              <div className="rounded-xl border border-line bg-[#fdfbf7] p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Delivery job</h3>
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                  <p><span className="text-muted">Pickup:</span> <span className="font-medium text-ink">{selected.delivery.pickup_name}</span> · {selected.delivery.pickup_address}</p>
                  <p><span className="text-muted">Drop-off:</span> <span className="font-medium text-ink">{selected.delivery.dropoff_address}</span></p>
                  <p><span className="text-muted">Distance:</span> {selected.delivery.distance_km ? `${selected.delivery.distance_km} km` : '—'}</p>
                  <p><span className="text-muted">Rider earning:</span> {currency(selected.delivery.rider_earning)}</p>
                </div>
              </div>
            ) : null}

            {selected.customer_instructions ? (
              <p className="rounded-xl border border-line bg-soft-yellow/60 px-4 py-3 text-xs leading-5 text-[#5f5a53]">
                <span className="font-semibold text-ink">Customer instructions:</span> {selected.customer_instructions}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted">
            <AlertCircle size={16} />
            {detailError || 'The order detail could not be loaded.'}
          </div>
        )}
      </Modal>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import {
  Bike,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Route,
  Wallet,
} from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Pagination,
  SearchInput,
  SectionCard,
  Select,
  StatCard,
  StatusBadge,
} from '../../components/ui'
import { currency, formatDateTime, number, timeAgo } from '../../lib/format'
import {
  fetchPlatformDeliveries,
  fetchPlatformOverview,
  fetchPlatformRiders,
  type PlatformDelivery,
  type PlatformOverview,
  type PlatformRider,
} from '../../lib/marketplace'

const PAGE_SIZE = 20

const DELIVERY_STATUSES = [
  { value: 'all', label: 'All delivery statuses' },
  { value: 'OPEN', label: 'Looking for a rider' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'PICKED_UP', label: 'Picked up' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function onlineBadge(rider: PlatformRider) {
  if (!rider.is_approved) return <Badge className="badge-yellow">Awaiting approval</Badge>
  if (rider.is_online) return <Badge className="badge-green">Online</Badge>
  return <Badge className="badge-gray">Offline</Badge>
}

export default function MarketplaceRiders() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [riders, setRiders] = useState<PlatformRider[]>([])
  const [riderCount, setRiderCount] = useState(0)
  const [riderPage, setRiderPage] = useState(1)
  const [deliveries, setDeliveries] = useState<PlatformDelivery[]>([])
  const [deliveryCount, setDeliveryCount] = useState(0)
  const [deliveryPage, setDeliveryPage] = useState(1)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [online, setOnline] = useState('all')
  const [approved, setApproved] = useState('all')
  const [deliveryStatus, setDeliveryStatus] = useState('all')
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
      setRiderPage(1)
      setDeliveryPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [riderData, deliveryData] = await Promise.all([
        fetchPlatformRiders({
          q: debounced || undefined,
          online,
          approved,
          page: riderPage,
          page_size: PAGE_SIZE,
        }),
        fetchPlatformDeliveries({
          q: debounced || undefined,
          status: deliveryStatus,
          page: deliveryPage,
          page_size: PAGE_SIZE,
        }),
      ])
      setRiders(riderData.results)
      setRiderCount(riderData.count)
      setDeliveries(deliveryData.results)
      setDeliveryCount(deliveryData.count)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Rider movement could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [debounced, online, approved, deliveryStatus, riderPage, deliveryPage])

  useEffect(() => {
    void load()
  }, [load])

  const stats = overview?.riders

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Live operations"
        title="Riders & deliveries"
        description="Who is online, who is carrying an order, and every delivery job moving through the marketplace."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCw size={13} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Riders"
          value={number(stats?.total || 0)}
          icon={<Bike size={17} />}
          tone="orange"
          hint={`${number(stats?.approved || 0)} approved`}
        />
        <StatCard
          label="Online now"
          value={number(stats?.online || 0)}
          icon={<MapPin size={17} />}
          tone="green"
          hint={`${number(stats?.active_jobs || 0)} active delivery jobs`}
        />
        <StatCard
          label="Deliveries today"
          value={number(stats?.deliveries_today || 0)}
          icon={<Route size={17} />}
          tone="blue"
          hint="Completed delivery jobs"
        />
        <StatCard
          label="Rider earnings today"
          value={currency(stats?.earnings_today)}
          icon={<Wallet size={17} />}
          tone="yellow"
          hint="Delivery fee + rider tip"
        />
      </div>

      <SectionCard
        title="Rider fleet"
        description="Search by name, phone, email or plate. Online and approval state come from the live rider profile."
        bodyClassName="p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search riders…" />
            <Select value={online} onChange={(event) => { setOnline(event.target.value); setRiderPage(1) }} className="w-auto text-xs">
              <option value="all">Any presence</option>
              <option value="true">Online</option>
              <option value="false">Offline</option>
            </Select>
            <Select value={approved} onChange={(event) => { setApproved(event.target.value); setRiderPage(1) }} className="w-auto text-xs">
              <option value="all">Any approval</option>
              <option value="true">Approved</option>
              <option value="false">Not approved</option>
            </Select>
          </div>
        }
      >
        {error ? (
          <div className="p-5"><ErrorState message={error} onRetry={() => void load()} /></div>
        ) : loading && riders.length === 0 ? (
          <div className="p-5"><LoadingBlock rows={7} /></div>
        ) : riders.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Bike size={22} />}
              title="No riders match these filters"
              message="Approved riders and their live presence appear here as soon as they join the marketplace."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[980px]">
                <thead>
                  <tr>
                    <th>Rider</th>
                    <th>Vehicle</th>
                    <th>Presence</th>
                    <th>Rating</th>
                    <th>Deliveries</th>
                    <th>Active jobs</th>
                    <th>Earnings</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {riders.map((rider) => (
                    <tr key={rider.id}>
                      <td>
                        <p className="font-semibold text-ink">{rider.name}</p>
                        <p className="text-[10px] text-muted">{rider.phone || rider.email || '—'}</p>
                      </td>
                      <td>
                        <p className="text-xs font-medium text-ink">{rider.vehicle_label}</p>
                        <p className="text-[10px] text-muted">{rider.license_plate || 'No plate'}</p>
                      </td>
                      <td>{onlineBadge(rider)}</td>
                      <td>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
                          <CheckCircle2 size={12} className="text-[#EAB544]" />
                          {Number(rider.rating_avg || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="tabular-nums">{number(rider.completed_jobs || rider.total_deliveries)}</td>
                      <td className="tabular-nums">{number(rider.active_jobs)}</td>
                      <td className="font-semibold tabular-nums text-ink">{currency(rider.earnings)}</td>
                      <td className="whitespace-nowrap text-muted">{timeAgo(rider.last_location_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={riderPage} pageSize={PAGE_SIZE} total={riderCount} onChange={setRiderPage} />
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Delivery jobs"
        description="Every pickup and drop-off, including jobs still waiting for a rider."
        bodyClassName="p-0"
        action={
          <Select value={deliveryStatus} onChange={(event) => { setDeliveryStatus(event.target.value); setDeliveryPage(1) }} className="w-auto text-xs">
            {DELIVERY_STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        }
      >
        {loading && deliveries.length === 0 ? (
          <div className="p-5"><LoadingBlock rows={6} /></div>
        ) : deliveries.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Route size={22} />}
              title="No delivery jobs yet"
              message="Platform-rider delivery jobs appear here from the moment they are created."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[980px]">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Rider</th>
                    <th>Status</th>
                    <th>Pickup</th>
                    <th>Drop-off</th>
                    <th>Distance</th>
                    <th>Rider earning</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((job) => (
                    <tr key={job.id}>
                      <td className="font-semibold text-ink">{job.order_code}</td>
                      <td>
                        <p className="text-xs font-medium text-ink">{job.rider_name || 'Unassigned'}</p>
                        <p className="text-[10px] text-muted">{job.rider_phone || '—'}</p>
                      </td>
                      <td><StatusBadge status={job.status} /></td>
                      <td className="max-w-[190px] truncate">{job.pickup_name}</td>
                      <td className="max-w-[190px] truncate">{job.dropoff_address}</td>
                      <td className="tabular-nums">{job.distance_km ? `${job.distance_km} km` : '—'}</td>
                      <td className="font-semibold tabular-nums text-ink">{currency(job.rider_earning)}</td>
                      <td className="whitespace-nowrap text-muted" title={formatDateTime(job.created_at)}>{timeAgo(job.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={deliveryPage} pageSize={PAGE_SIZE} total={deliveryCount} onChange={setDeliveryPage} />
          </>
        )}
      </SectionCard>
    </div>
  )
}

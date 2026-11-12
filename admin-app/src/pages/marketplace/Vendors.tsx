import { useCallback, useEffect, useState } from 'react'
import {
  ClipboardList,
  RefreshCw,
  Star,
  Store,
  UtensilsCrossed,
} from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Pagination,
  RatingStars,
  SearchInput,
  SectionCard,
  Select,
  StatCard,
  Tabs,
} from '../../components/ui'
import { currency, formatDate, number } from '../../lib/format'
import {
  fetchPlatformMenuItems,
  fetchPlatformOverview,
  fetchPlatformReviews,
  fetchPlatformVendors,
  type PlatformMenuItem,
  type PlatformOverview,
  type PlatformReview,
  type PlatformVendor,
} from '../../lib/marketplace'

const PAGE_SIZE = 20

const AVAILABILITY_OPTIONS = [
  { value: 'all', label: 'All availability' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'SOLD_OUT', label: 'Sold out' },
  { value: 'HIDDEN', label: 'Hidden' },
]

const RATING_OPTIONS = [
  { value: 'all', label: 'All ratings' },
  { value: '5', label: '5 stars' },
  { value: '4', label: '4 stars' },
  { value: '3', label: '3 stars' },
  { value: '2', label: '2 stars' },
  { value: '1', label: '1 star' },
]

function availabilityTone(status: string) {
  if (status === 'AVAILABLE') return 'badge-green'
  if (status === 'SOLD_OUT') return 'badge-yellow'
  return 'badge-gray'
}

export default function MarketplaceVendors() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [tab, setTab] = useState('vendors')

  const [vendors, setVendors] = useState<PlatformVendor[]>([])
  const [vendorCount, setVendorCount] = useState(0)
  const [vendorPage, setVendorPage] = useState(1)
  const [vendorQuery, setVendorQuery] = useState('')
  const [vendorDebounced, setVendorDebounced] = useState('')
  const [approved, setApproved] = useState('all')
  const [online, setOnline] = useState('all')
  const [vendorLoading, setVendorLoading] = useState(true)

  const [menuItems, setMenuItems] = useState<PlatformMenuItem[]>([])
  const [menuCount, setMenuCount] = useState(0)
  const [menuPage, setMenuPage] = useState(1)
  const [menuQuery, setMenuQuery] = useState('')
  const [menuDebounced, setMenuDebounced] = useState('')
  const [availability, setAvailability] = useState('all')
  const [archived, setArchived] = useState('all')
  const [menuLoading, setMenuLoading] = useState(true)

  const [reviews, setReviews] = useState<PlatformReview[]>([])
  const [reviewCount, setReviewCount] = useState(0)
  const [reviewPage, setReviewPage] = useState(1)
  const [reviewQuery, setReviewQuery] = useState('')
  const [reviewDebounced, setReviewDebounced] = useState('')
  const [rating, setRating] = useState('all')
  const [reviewLoading, setReviewLoading] = useState(true)

  const [error, setError] = useState('')

  useEffect(() => {
    fetchPlatformOverview(30)
      .then(setOverview)
      .catch(() => setOverview(null))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVendorDebounced(vendorQuery)
      setVendorPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [vendorQuery])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMenuDebounced(menuQuery)
      setMenuPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [menuQuery])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReviewDebounced(reviewQuery)
      setReviewPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [reviewQuery])

  const loadVendors = useCallback(async () => {
    setVendorLoading(true)
    setError('')
    try {
      const data = await fetchPlatformVendors({
        q: vendorDebounced || undefined,
        approved,
        online,
        page: vendorPage,
        page_size: PAGE_SIZE,
      })
      setVendors(data.results)
      setVendorCount(data.count)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Vendors could not be loaded.')
    } finally {
      setVendorLoading(false)
    }
  }, [vendorDebounced, approved, online, vendorPage])

  const loadMenu = useCallback(async () => {
    setMenuLoading(true)
    setError('')
    try {
      const data = await fetchPlatformMenuItems({
        q: menuDebounced || undefined,
        availability,
        archived,
        page: menuPage,
        page_size: PAGE_SIZE,
      })
      setMenuItems(data.results)
      setMenuCount(data.count)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Food items could not be loaded.')
    } finally {
      setMenuLoading(false)
    }
  }, [menuDebounced, availability, archived, menuPage])

  const loadReviews = useCallback(async () => {
    setReviewLoading(true)
    setError('')
    try {
      const data = await fetchPlatformReviews({
        q: reviewDebounced || undefined,
        rating,
        page: reviewPage,
        page_size: PAGE_SIZE,
      })
      setReviews(data.results)
      setReviewCount(data.count)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reviews could not be loaded.')
    } finally {
      setReviewLoading(false)
    }
  }, [reviewDebounced, rating, reviewPage])

  useEffect(() => {
    if (tab === 'vendors') void loadVendors()
  }, [tab, loadVendors])

  useEffect(() => {
    if (tab === 'menu') void loadMenu()
  }, [tab, loadMenu])

  useEffect(() => {
    if (tab === 'reviews') void loadReviews()
  }, [tab, loadReviews])

  const refresh = () => {
    if (tab === 'vendors') void loadVendors()
    else if (tab === 'menu') void loadMenu()
    else void loadReviews()
  }

  const stats = overview?.vendors
  const food = overview?.food

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Marketplace catalogue"
        title="Vendors & food"
        description="The businesses selling on Agiza, the food they list, and what customers say after delivery."
        actions={
          <Button variant="secondary" size="sm" onClick={refresh} loading={vendorLoading || menuLoading || reviewLoading}>
            <RefreshCw size={13} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Vendors"
          value={number(stats?.total || 0)}
          icon={<Store size={17} />}
          tone="orange"
          hint={`${number(stats?.approved || 0)} approved · ${number(stats?.pending || 0)} pending`}
        />
        <StatCard
          label="Online now"
          value={number(stats?.online || 0)}
          icon={<ClipboardList size={17} />}
          tone="green"
          hint="Accepting orders right now"
        />
        <StatCard
          label="Menu items"
          value={number(food?.menu_items || 0)}
          icon={<UtensilsCrossed size={17} />}
          tone="blue"
          hint={`${number(food?.available || 0)} available · ${number(food?.sold_out || 0)} sold out`}
        />
        <StatCard
          label="Average rating"
          value={Number(food?.average_rating || 0).toFixed(2)}
          icon={<Star size={17} />}
          tone="yellow"
          hint={`${number(food?.reviews || 0)} customer reviews`}
        />
      </div>

      <Tabs
        tabs={[
          { id: 'vendors', label: 'Vendors', count: vendorCount },
          { id: 'menu', label: 'Food & menu', count: menuCount },
          { id: 'reviews', label: 'Reviews', count: reviewCount },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {tab === 'vendors' ? (
        <SectionCard
          title="Vendor directory"
          description="Approval, online state, order volume and revenue for every business."
          bodyClassName="p-0"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={vendorQuery} onChange={setVendorQuery} placeholder="Search vendors…" />
              <Select value={approved} onChange={(event) => { setApproved(event.target.value); setVendorPage(1) }} className="w-auto text-xs">
                <option value="all">Any approval</option>
                <option value="true">Approved</option>
                <option value="false">Not approved</option>
              </Select>
              <Select value={online} onChange={(event) => { setOnline(event.target.value); setVendorPage(1) }} className="w-auto text-xs">
                <option value="all">Any presence</option>
                <option value="true">Online</option>
                <option value="false">Offline</option>
              </Select>
            </div>
          }
        >
          {vendorLoading && vendors.length === 0 ? (
            <div className="p-5"><LoadingBlock rows={7} /></div>
          ) : vendors.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Store size={22} />}
                title="No vendors match these filters"
                message="Approved and pending vendors appear here as soon as they register."
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1050px]">
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>Owner</th>
                      <th>Type</th>
                      <th>Approval</th>
                      <th>Online</th>
                      <th>Rating</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                      <th>Menu</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((vendor) => (
                      <tr key={vendor.id}>
                        <td>
                          <p className="font-semibold text-ink">{vendor.business_name}</p>
                          <p className="max-w-[220px] truncate text-[10px] text-muted">{vendor.address || '—'}</p>
                        </td>
                        <td>
                          <p className="text-xs font-medium text-ink">{vendor.owner_name}</p>
                          <p className="text-[10px] text-muted">{vendor.owner_phone || vendor.owner_email || '—'}</p>
                        </td>
                        <td className="text-xs">{vendor.business_type_label}</td>
                        <td>
                          <Badge className={vendor.is_approved ? 'badge-green' : 'badge-yellow'}>
                            {vendor.is_approved ? 'Approved' : 'Pending'}
                          </Badge>
                        </td>
                        <td>
                          <Badge className={vendor.is_online ? 'badge-green' : 'badge-gray'}>
                            {vendor.is_online ? 'Online' : 'Offline'}
                          </Badge>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
                            <Star size={12} className="text-[#EAB544]" />
                            {Number(vendor.rating_avg || 0).toFixed(2)}
                          </span>
                          <p className="text-[10px] text-muted">{number(vendor.rating_count)} reviews</p>
                        </td>
                        <td className="tabular-nums">{number(vendor.order_count)}</td>
                        <td className="font-semibold tabular-nums text-ink">{currency(vendor.revenue)}</td>
                        <td className="tabular-nums">{number(vendor.menu_item_count)}</td>
                        <td className="whitespace-nowrap text-muted">{formatDate(vendor.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={vendorPage} pageSize={PAGE_SIZE} total={vendorCount} onChange={setVendorPage} />
            </>
          )}
        </SectionCard>
      ) : null}

      {tab === 'menu' ? (
        <SectionCard
          title="Food catalogue"
          description="Every dish across every vendor, with live availability and sales."
          bodyClassName="p-0"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={menuQuery} onChange={setMenuQuery} placeholder="Search food…" />
              <Select value={availability} onChange={(event) => { setAvailability(event.target.value); setMenuPage(1) }} className="w-auto text-xs">
                {AVAILABILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
              <Select value={archived} onChange={(event) => { setArchived(event.target.value); setMenuPage(1) }} className="w-auto text-xs">
                <option value="all">Active + archived</option>
                <option value="false">Active only</option>
                <option value="true">Archived only</option>
              </Select>
            </div>
          }
        >
          {menuLoading && menuItems.length === 0 ? (
            <div className="p-5"><LoadingBlock rows={7} /></div>
          ) : menuItems.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<UtensilsCrossed size={22} />}
                title="No food items match these filters"
                message="Vendors' dishes appear here as soon as they publish a menu."
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1050px]">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Vendor</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Availability</th>
                      <th>Portions</th>
                      <th>Prep</th>
                      <th>Orders</th>
                      <th>Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <p className="font-semibold text-ink">{item.name}</p>
                          <p className="max-w-[220px] truncate text-[10px] text-muted">{item.description || '—'}</p>
                        </td>
                        <td className="max-w-[170px] truncate text-xs">{item.vendor_name}</td>
                        <td className="text-xs">{item.category_name || '—'}</td>
                        <td className="font-semibold tabular-nums text-ink">{currency(item.price)}</td>
                        <td><Badge className={availabilityTone(item.availability_status)}>{item.availability_label}</Badge></td>
                        <td className="tabular-nums">{item.portions_available ?? '∞'}</td>
                        <td className="tabular-nums">{item.preparation_minutes}m</td>
                        <td className="tabular-nums">{number(item.order_count)}</td>
                        <td className="tabular-nums">{number(item.quantity_sold)}</td>
                        <td className="font-semibold tabular-nums text-ink">{currency(item.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={menuPage} pageSize={PAGE_SIZE} total={menuCount} onChange={setMenuPage} />
            </>
          )}
        </SectionCard>
      ) : null}

      {tab === 'reviews' ? (
        <SectionCard
          title="Customer reviews"
          description="Ratings and comments left after a completed order."
          bodyClassName="p-0"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={reviewQuery} onChange={setReviewQuery} placeholder="Search reviews…" />
              <Select value={rating} onChange={(event) => { setRating(event.target.value); setReviewPage(1) }} className="w-auto text-xs">
                {RATING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </div>
          }
        >
          {reviewLoading && reviews.length === 0 ? (
            <div className="p-5"><LoadingBlock rows={6} /></div>
          ) : reviews.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Star size={22} />}
                title="No reviews match these filters"
                message="Customer reviews appear here after an order is completed and rated."
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[900px]">
                  <thead>
                    <tr>
                      <th>Rating</th>
                      <th>Vendor</th>
                      <th>Customer</th>
                      <th>Order</th>
                      <th>Comment</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((review) => (
                      <tr key={review.id}>
                        <td><RatingStars rating={review.rating} showValue /></td>
                        <td className="max-w-[170px] truncate text-xs font-medium text-ink">{review.vendor_name}</td>
                        <td className="text-xs">{review.customer_name}</td>
                        <td className="text-xs text-muted">{review.order_code}</td>
                        <td className="max-w-[320px] truncate text-muted">{review.comment || '—'}</td>
                        <td className="whitespace-nowrap text-muted">{formatDate(review.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={reviewPage} pageSize={PAGE_SIZE} total={reviewCount} onChange={setReviewPage} />
            </>
          )}
        </SectionCard>
      ) : null}
    </div>
  )
}

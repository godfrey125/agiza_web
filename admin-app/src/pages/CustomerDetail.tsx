import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Banknote, Mail, Phone, Plus, Receipt, Star, TrendingUp } from 'lucide-react'
import { api } from '../lib/api'
import type { CustomerDetail } from '../lib/types'
import { currency, formatDate, number } from '../lib/format'
import {
  Avatar, EmptyState, ErrorState, FoodImage, PageHeader, RatingStars, SectionCard, StatusBadge,
} from '../components/ui'

export default function CustomerDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get<CustomerDetail>(`/api/customers/${id}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this customer.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="space-y-4"><div className="skeleton h-8 w-60" /><div className="skeleton h-[430px] rounded-2xl" /></div>
  if (error || !data) return <ErrorState message={error || 'Customer not found.'} />

  const { customer, stats, orders, favorites, reviews } = data
  const initials = customer.name.slice(0, 1).toUpperCase()
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Customers', href: '/customers' }, { label: customer.name }]}
        eyebrow="Guest profile"
        title={customer.name}
        description={`Guest since ${formatDate(customer.created_at)} · ${stats.orders} order${stats.orders === 1 ? '' : 's'} on record.`}
        actions={(
          <>
            <Link to="/customers" className="btn-secondary"><ArrowLeft size={15} /> Back to customers</Link>
            <Link to="/orders?new=1" className="btn-primary"><Plus size={15} /> New order</Link>
          </>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1.9fr]">
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-center gap-4">
              <Avatar src={customer.image_url} name={customer.name} size={70} />
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-extrabold tracking-tight text-ink">{customer.name}</p>
                <p className="mt-1 text-xs text-muted">Guest profile #{customer.id}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={stats.orders >= 6 ? 'VIP' : stats.orders >= 2 ? 'RETURNING' : 'NEW'} />
                  <span className="badge-gray">{initials} guest</span>
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
              <div className="flex items-center gap-2.5 text-[#5f5a53]"><Mail size={15} className="text-muted" /><span className="truncate">{customer.email || 'No email address'}</span></div>
              <div className="flex items-center gap-2.5 text-[#5f5a53]"><Phone size={15} className="text-muted" /><span>{customer.phone || 'No phone number'}</span></div>
              <div className="flex items-center gap-2.5 text-[#5f5a53]"><CalendarDays size={15} className="text-muted" /><span>Joined {formatDate(customer.created_at)}</span></div>
            </div>
            {customer.notes && <div className="mt-5 rounded-xl bg-[#fbf8f3] p-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Notes</p><p className="mt-1.5 text-xs leading-5 text-[#5f5a53]">{customer.notes}</p></div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['Orders', number(stats.orders), <Receipt size={16} />, 'text-primary'],
              ['Lifetime spend', currency(stats.spend), <Banknote size={16} />, 'text-success'],
              ['Average order', currency(stats.averageOrder), <TrendingUp size={16} />, 'text-[#9A7214]'],
              ['Last order', stats.lastOrder ? formatDate(stats.lastOrder) : '—', <CalendarDays size={16} />, 'text-[#3569B4]'],
            ].map(([label, value, icon, tone]) => (
              <div key={String(label)} className="card p-4">
                <span className={tone as string}>{icon as React.ReactNode}</span>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label as string}</p>
                <p className="mt-1 truncate font-display text-lg font-extrabold text-ink">{value}</p>
              </div>
            ))}
          </div>

          <SectionCard title="Favourite dishes" description="The plates this guest orders most." action={<Star size={17} className="text-warning" />}>
            {favorites.length ? (
              <div className="space-y-3">
                {favorites.map((item, index) => (
                  <Link key={item.id} to={`/menu/${item.id}`} className="flex items-center gap-3 rounded-xl border border-line p-2.5 transition hover:border-primary/30">
                    <span className="w-4 text-center font-display text-xs font-bold text-[#bbb2a6]">{index + 1}</span>
                    <FoodImage src={item.imageUrl} alt={item.name} className="h-10 w-10 shrink-0" />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-ink">{item.name}</p><p className="mt-0.5 text-[10px] text-muted">{number(item.quantity)} ordered</p></div>
                    <span className="text-xs font-bold text-ink">{currency(item.revenue)}</span>
                  </Link>
                ))}
              </div>
            ) : <EmptyState icon={<Receipt size={22} />} title="No favourite dishes yet" message="Favourites appear after this guest places an order." />}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Order history" description="Every visit and order attached to this profile." action={<Receipt size={17} className="text-primary" />} bodyClassName="p-0">
            {orders.length ? (
              <div className="table-wrap rounded-none border-0">
                <table className="data-table min-w-[560px]">
                  <thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td><Link to={`/orders/${order.id}`} className="font-semibold text-primary hover:underline">{order.order_number}</Link></td>
                        <td className="text-xs text-muted">{formatDate(order.created_at)}</td>
                        <td className="font-semibold text-ink">{currency(order.total)}</td>
                        <td><StatusBadge status={order.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="p-5"><EmptyState icon={<Receipt size={22} />} title="No orders yet" message="This guest has not placed an order yet." action={<Link to="/orders?new=1" className="btn-primary btn-sm">Create order</Link>} /></div>}
          </SectionCard>

          <SectionCard title="Reviews left" description="What this guest said about their visit." action={<Star size={17} className="text-warning" />}>
            {reviews.length ? (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-line p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <RatingStars rating={review.rating} />
                      <span className="text-[10px] text-muted">{formatDate(review.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ink">{review.title || 'Guest review'}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{review.message}</p>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={<Star size={22} />} title="No reviews yet" message="Guest feedback will appear here after a review is recorded." />}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

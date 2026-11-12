import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChefHat, Clock3, Banknote, Package, Receipt, Star, UtensilsCrossed } from 'lucide-react'
import { api } from '../lib/api'
import type { InventoryResponse, MenuDetail } from '../lib/types'
import { currency, formatDate, number, percent } from '../lib/format'
import { Button, EmptyState, ErrorState, FoodImage, PageHeader, RatingStars, SectionCard, StatusBadge } from '../components/ui'

export default function MenuDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<MenuDetail | null>(null)
  const [inventory, setInventory] = useState<InventoryResponse['items']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      api.get<MenuDetail>(`/api/menu/${id}`),
      api.get<InventoryResponse>('/api/inventory').catch(() => ({ items: [], summary: {}, categories: [] } as unknown as InventoryResponse)),
    ]).then(([detail, stock]) => {
      if (cancelled) return
      setData(detail)
      setInventory(stock.items || [])
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this menu item.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return <div className="space-y-4"><div className="skeleton h-8 w-56" /><div className="skeleton h-[480px] rounded-2xl" /></div>
  }
  if (error || !data) return <ErrorState message={error || 'Menu item not found.'} />

  const item = data.item
  const recipe = (item.recipe || []).map((entry) => {
    const stock = inventory.find((row) => row.id === Number(entry.inventoryId))
    return { ...entry, name: stock?.name || `Inventory #${entry.inventoryId}`, unit: stock?.unit || '', available: stock?.quantity ?? 0 }
  })

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Menu Items', href: '/menu' }, { label: item.name }]}
        eyebrow={item.category_name || 'Menu item'}
        title={item.name}
        description={item.description || 'A menu item in the Agiza Admin restaurant workspace.'}
        actions={(
          <>
            <Link to="/menu" className="btn-secondary"><ArrowLeft size={15} /> Back to menu</Link>
            <Link to={`/orders?q=${encodeURIComponent(item.name)}`} className="btn-primary"><Receipt size={15} /> View orders</Link>
          </>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1.9fr]">
        <div className="space-y-5">
          <div className="card overflow-hidden">
            <FoodImage src={item.imageUrl || item.image_url} alt={item.name} rounded="rounded-none" className="h-[300px] w-full" />
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2"><StatusBadge status={item.available ? 'Available' : 'Unavailable'} />{item.featured && <span className="badge-orange">Featured</span>}</div>
                <p className="font-display text-2xl font-extrabold tracking-tight text-ink">{currency(item.price)}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-[#fbf8f3] p-3"><p className="text-muted">Cost price</p><p className="mt-1 font-bold text-ink">{currency(item.costPrice)}</p></div>
                <div className="rounded-xl bg-[#fbf8f3] p-3"><p className="text-muted">Profit margin</p><p className="mt-1 font-bold text-success">{percent(item.profitMargin)}</p></div>
                <div className="rounded-xl bg-[#fbf8f3] p-3"><p className="text-muted">Prep time</p><p className="mt-1 font-bold text-ink">{item.preparationTime} min</p></div>
                <div className="rounded-xl bg-[#fbf8f3] p-3"><p className="text-muted">Category</p><p className="mt-1 truncate font-bold text-ink">{item.category_name || '—'}</p></div>
              </div>
              {item.ingredients && <div className="mt-4"><p className="label">Ingredients</p><p className="text-xs leading-6 text-muted">{item.ingredients}</p></div>}
            </div>
          </div>

          <SectionCard title="Recipe & stock" description="Deducted automatically when an order is completed.">
            {recipe.length ? (
              <div className="space-y-3">
                {recipe.map((entry) => (
                  <div key={entry.inventoryId} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Package size={14} className="shrink-0 text-muted" />
                      <span className="truncate text-sm font-medium text-ink">{entry.name}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-bold text-ink">{entry.quantity} {entry.unit}</p>
                      <p className={`text-[10px] ${entry.available <= 0 ? 'text-coral' : 'text-muted'}`}>{entry.available} on hand</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={<Package size={22} />} title="No recipe linked" message="Link inventory ingredients from the menu editor to deduct stock when orders are completed." />}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Orders', number(data.stats.orders), <Receipt size={16} />],
              ['Servings sold', number(data.stats.quantity), <UtensilsCrossed size={16} />],
              ['Revenue', currency(data.stats.revenue), <Banknote size={16} />],
              ['Avg / order', currency(data.stats.averageOrder), <Star size={16} />],
            ].map(([label, value, icon]) => (
              <div key={String(label)} className="card p-4">
                <span className="text-primary">{icon}</span>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
                <p className="mt-1 font-display text-lg font-extrabold text-ink">{value}</p>
              </div>
            ))}
          </div>

          <SectionCard title="Recent orders" description="The last times this dish left the kitchen." action={<ChefHat size={17} className="text-primary" />} bodyClassName="p-0">
            {data.recentOrders.length ? (
              <div className="table-wrap rounded-none border-0">
                <table className="data-table min-w-[560px]">
                  <thead><tr><th>Order</th><th>Guest</th><th>Qty</th><th>Value</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {data.recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td><Link to={`/orders/${order.id}`} className="font-semibold text-primary hover:underline">{order.order_number}</Link></td>
                        <td>{order.customer_name || 'Walk-in'}</td>
                        <td>{number(order.quantity)}</td>
                        <td className="font-semibold">{currency(order.subtotal)}</td>
                        <td><StatusBadge status={order.status} /></td>
                        <td className="text-xs text-muted">{formatDate(order.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="p-5"><EmptyState title="No orders yet" message="This item will appear in order history after its first sale." /></div>}
          </SectionCard>

          <SectionCard title="Guest feedback" description="Reviews linked to this dish." action={<Star size={17} className="text-warning" />}>
            {data.reviews.length ? (
              <div className="space-y-3">
                {data.reviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-line p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <RatingStars rating={review.rating} />
                      <span className="text-[10px] text-muted">{formatDate(review.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ink">{review.title || review.message}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{review.message}</p>
                    <p className="mt-2 text-[10px] font-medium text-muted">{review.customer_name || 'Guest'}</p>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={<Star size={22} />} title="No reviews yet" message="Guest feedback for this dish will show up here." />}
          </SectionCard>

          <div className="card flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs text-muted"><Clock3 size={14} /> Preparation estimate is {item.preparationTime} minutes.</div>
            <Link to={`/menu`} className="text-xs font-semibold text-primary hover:underline">Manage this item in Menu Items</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

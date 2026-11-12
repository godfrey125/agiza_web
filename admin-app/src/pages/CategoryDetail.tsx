import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Banknote, Receipt, Tags, UtensilsCrossed } from 'lucide-react'
import { api } from '../lib/api'
import type { CategoryDetail } from '../lib/types'
import { currency, number } from '../lib/format'
import { EmptyState, ErrorState, FoodImage, PageHeader, SectionCard, StatusBadge } from '../components/ui'

export default function CategoryDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<CategoryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get<CategoryDetail>(`/api/categories/${id}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this category.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="space-y-4"><div className="skeleton h-8 w-56" /><div className="skeleton h-[360px] rounded-2xl" /></div>
  if (error || !data) return <ErrorState message={error || 'Category not found.'} />

  const { category, stats, items } = data
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Categories', href: '/categories' }, { label: category.name }]}
        eyebrow="Category detail"
        title={category.name}
        description={category.description || 'A category in the Agiza Admin menu structure.'}
        actions={<Link to="/categories" className="btn-secondary"><ArrowLeft size={15} /> Back to categories</Link>}
      />

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1.7fr]">
        <div className="card overflow-hidden">
          <FoodImage src={category.image_url} alt={category.name} rounded="rounded-none" className="h-[250px] w-full" />
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><StatusBadge status={category.status} /><span className="badge-orange"><Tags size={10} /> Category</span></div>
              <p className="font-display text-xl font-extrabold text-ink">{number(items.length)} dishes</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#fbf8f3] p-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Orders</p><p className="mt-1 font-display text-xl font-extrabold text-ink">{number(stats.orders)}</p></div>
              <div className="rounded-xl bg-[#fbf8f3] p-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Revenue</p><p className="mt-1 font-display text-xl font-extrabold text-primary">{currency(stats.revenue)}</p></div>
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-line px-3.5 py-3 text-xs text-muted"><Receipt size={14} className="text-primary" /> These figures include all non-cancelled orders.</div>
          </div>
        </div>

        <SectionCard title="Dishes in this category" description="Live sales performance per menu item." action={<UtensilsCrossed size={17} className="text-primary" />} bodyClassName="p-0">
          {items.length ? (
            <div className="table-wrap rounded-none border-0">
              <table className="data-table">
                <thead><tr><th>Dish</th><th>Price</th><th>Sold</th><th>Availability</th></tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <FoodImage src={item.image_url || item.imageUrl} alt={item.name} className="h-10 w-10 shrink-0" />
                          <div><Link to={`/menu/${item.id}`} className="font-semibold text-ink hover:text-primary">{item.name}</Link><p className="text-xs text-muted">{currency(item.costPrice)} cost</p></div>
                        </div>
                      </td>
                      <td className="font-semibold text-ink">{currency(item.price)}</td>
                      <td>{number(item.sales)}</td>
                      <td><StatusBadge status={item.available ? 'Available' : 'Unavailable'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState icon={<UtensilsCrossed size={22} />} title="This category is empty" message="Add menu items to this category to start tracking its performance." action={<Link to="/menu" className="btn-primary btn-sm"><UtensilsCrossed size={13} /> Open menu</Link>} />
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-5 card flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-xs text-muted"><Banknote size={14} className="text-primary" /> Category revenue flows into dashboard, analytics and reports automatically.</div>
        <Link to="/analytics" className="text-xs font-semibold text-primary hover:underline">Explore category analytics</Link>
      </div>
    </div>
  )
}

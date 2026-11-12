import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChefHat, Eye, Flame, LayoutGrid, Pencil, Plus, Power, SlidersHorizontal, Sparkles,
  Trash2, UtensilsCrossed,
} from 'lucide-react'
import { api } from '../lib/api'
import type { CategoryResponse, InventoryResponse, MenuItem, MenuResponse } from '../lib/types'
import { currency, number, percent } from '../lib/format'
import {
  Button, EmptyState, ErrorState, Field, FoodImage, ImageUploader, Input, LoadingCards,
  Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge, Textarea, Toggle, useConfirm, useToast,
} from '../components/ui'

interface RecipeEntry { inventoryId: number; quantity: number }

const emptyForm = {
  name: '', description: '', categoryId: '', price: '', costPrice: '', ingredients: '',
  preparationTime: '20', imageUrl: '', available: true, featured: false,
}

export default function MenuPage() {
  const [data, setData] = useState<MenuResponse | null>(null)
  const [categories, setCategories] = useState<CategoryResponse['items']>([])
  const [inventory, setInventory] = useState<InventoryResponse['items']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [availability, setAvailability] = useState('all')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({ ...emptyForm })
  const [recipe, setRecipe] = useState<RecipeEntry[]>([])
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '12', q: query, category, availability, sort })
      const result = await api.get<MenuResponse>(`/api/menu?${params.toString()}`)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the menu.')
    } finally {
      setLoading(false)
    }
  }, [page, query, category, availability, sort])

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 260)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    api.get<CategoryResponse>('/api/categories').then((result) => setCategories(result.items)).catch(() => setCategories([]))
    api.get<InventoryResponse>('/api/inventory').then((result) => setInventory(result.items)).catch(() => setInventory([]))
  }, [])

  useEffect(() => { setPage(1) }, [query, category, availability, sort])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, categoryId: categories[0]?.id ? String(categories[0].id) : '' })
    setRecipe([])
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditing(item)
    setForm({
      name: item.name,
      description: item.description || '',
      categoryId: item.category_id ? String(item.category_id) : '',
      price: String(item.price),
      costPrice: String(item.costPrice),
      ingredients: item.ingredients || '',
      preparationTime: String(item.preparationTime),
      imageUrl: item.image_url || item.imageUrl || '',
      available: item.available,
      featured: item.featured,
    })
    setRecipe((item.recipe || []).map((entry) => ({ inventoryId: Number(entry.inventoryId), quantity: Number(entry.quantity) })))
    setFormError('')
    setModalOpen(true)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (!form.name.trim()) return setFormError('Give this dish a name.')
    if (!form.categoryId) return setFormError('Choose a category.')
    if (Number(form.price) <= 0) return setFormError('Selling price must be greater than zero.')
    setSaving(true)
    try {
      const payload = {
        ...form,
        categoryId: Number(form.categoryId),
        price: Number(form.price),
        costPrice: Number(form.costPrice || 0),
        preparationTime: Number(form.preparationTime || 20),
        recipe: recipe.filter((entry) => entry.inventoryId && entry.quantity > 0),
      }
      if (editing) await api.put(`/api/menu/${editing.id}`, payload)
      else await api.post('/api/menu', payload)
      toast(editing ? 'Menu item updated.' : 'Menu item created.', 'success')
      setModalOpen(false)
      load(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the menu item.')
    } finally {
      setSaving(false)
    }
  }

  const toggleAvailability = async (item: MenuItem) => {
    try {
      await api.put(`/api/menu/${item.id}`, { available: !item.available })
      toast(`${item.name} is now ${item.available ? 'unavailable' : 'available'}.`, 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update availability.', 'error')
    }
  }

  const remove = async (item: MenuItem) => {
    const ok = await confirm({
      title: 'Delete menu item?',
      message: `“${item.name}” will be removed from the menu. Historical order lines keep their recorded name and price.`,
      confirmLabel: 'Delete item',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/api/menu/${item.id}`)
      toast('Menu item deleted.', 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete the item.', 'error')
    }
  }

  const summary = data?.summary
  const addRecipeRow = () => {
    const available = inventory.find((item) => !recipe.some((entry) => entry.inventoryId === item.id))
    if (!available) return toast('Every inventory item is already linked.', 'info')
    setRecipe((current) => [...current, { inventoryId: available.id, quantity: 1 }])
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Menu Items' }]}
        eyebrow="Menu studio"
        title="Menu items"
        description="Shape the dishes guests see, keep prices and costs honest, and connect recipes to live inventory consumption."
        actions={<Button icon={<Plus size={16} />} onClick={openCreate}>Add menu item</Button>}
      />

      {!loading && summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Total dishes', summary.total, 'text-ink', <LayoutGrid size={16} />],
            ['Available', summary.available, 'text-success', <Power size={16} />],
            ['Hidden today', summary.unavailable, 'text-coral', <SlidersHorizontal size={16} />],
            ['Featured', summary.featured, 'text-primary', <Sparkles size={16} />],
          ].map(([label, value, tone, icon]) => (
            <div key={String(label)} className="card flex items-center gap-3 p-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbf8f3] ${String(tone)}`}>{icon as React.ReactNode}</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label as string}</p>
                <p className="mt-0.5 font-display text-lg font-extrabold text-ink">{number(Number(value))}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card mb-5 flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Search dishes, ingredients…" />
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:justify-end">
          <Select value={category} onChange={(event) => setCategory(event.target.value)} className="text-xs lg:w-[150px]">
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          <Select value={availability} onChange={(event) => setAvailability(event.target.value)} className="text-xs lg:w-[145px]">
            <option value="all">Any availability</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value)} className="col-span-2 text-xs sm:col-span-1 lg:w-[145px]">
            <option value="newest">Newest first</option>
            <option value="name">Name A–Z</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="sales">Best selling</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <LoadingCards count={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={<UtensilsCrossed size={24} />}
          title={query || category !== 'all' || availability !== 'all' ? 'No dishes match these filters' : 'Your menu is waiting'}
          message={query || category !== 'all' || availability !== 'all' ? 'Try a different search, category or availability filter.' : 'Add the first dish to start taking orders and showing menu performance.'}
          action={<Button icon={<Plus size={15} />} onClick={openCreate}>Add a menu item</Button>}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((item) => (
              <article key={item.id} className="card card-interactive group overflow-hidden">
                <div className="relative">
                  <Link to={`/menu/${item.id}`} className="block">
                    <FoodImage src={item.imageUrl || item.image_url} alt={item.name} rounded="rounded-none" className="h-[164px] w-full" />
                  </Link>
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    <StatusBadge status={item.available ? 'Available' : 'Unavailable'} />
                    {item.featured && <span className="badge-orange"><Sparkles size={10} /> Featured</span>}
                  </div>
                  <button type="button" onClick={() => toggleAvailability(item)} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/60 bg-white/90 text-muted shadow-soft backdrop-blur transition hover:text-primary" title={item.available ? 'Mark unavailable' : 'Mark available'}>
                    <Power size={14} />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">{item.category_name || 'Uncategorized'}</p>
                      <Link to={`/menu/${item.id}`} className="mt-1 block truncate font-display text-base font-bold tracking-tight text-ink hover:text-primary">{item.name}</Link>
                    </div>
                    <p className="shrink-0 font-display text-lg font-extrabold tracking-tight text-ink">{currency(item.price)}</p>
                  </div>
                  <p className="mt-2 line-clamp-2 min-h-[40px] text-xs leading-5 text-muted">{item.description || 'No description added yet.'}</p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
                    <span className="rounded-lg bg-[#fbf8f3] px-2 py-1">{number(item.sales)} sold</span>
                    <span className="rounded-lg bg-[#fbf8f3] px-2 py-1">{percent(item.profitMargin, 0)} margin</span>
                    <span className="ml-auto flex items-center gap-1"><ChefHat size={12} /> {item.preparationTime} min</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
                    <Link to={`/menu/${item.id}`} className="btn-secondary btn-sm flex-1"><Eye size={13} /> View</Link>
                    <button type="button" onClick={() => openEdit(item)} className="icon-btn h-8 w-8" aria-label="Edit item"><Pencil size={14} /></button>
                    <button type="button" onClick={() => remove(item)} className="icon-btn h-8 w-8 hover:text-coral" aria-label="Delete item"><Trash2 size={14} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="card mt-4 overflow-hidden">
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit menu item' : 'Add menu item'}
        description="Menu details, pricing and the recipe that drives inventory consumption."
        width="max-w-3xl"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving} icon={<UtensilsCrossed size={15} />}>{editing ? 'Save changes' : 'Create item'}</Button>
          </>
        )}
      >
        <form onSubmit={save} className="space-y-5">
          {formError && <div className="rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{formError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dish name" required className="sm:col-span-2">
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Butter Chicken" />
            </Field>
            <Field label="Category" required>
              <Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                <option value="">Choose a category</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Preparation time" hint="Estimated minutes from order to pass.">
              <Input type="number" min="1" value={form.preparationTime} onChange={(event) => setForm({ ...form, preparationTime: event.target.value })} />
            </Field>
            <Field label="Selling price" required>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="0.00" />
            </Field>
            <Field label="Cost price" hint="Used for margin and profit reports.">
              <Input type="number" min="0" step="0.01" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} placeholder="0.00" />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What makes this dish memorable?" className="min-h-[84px]" />
            </Field>
            <Field label="Visible ingredients" className="sm:col-span-2" hint="Shown to guests and used in menu search.">
              <Input value={form.ingredients} onChange={(event) => setForm({ ...form, ingredients: event.target.value })} placeholder="Chicken, tomato, butter, cream…" />
            </Field>
            <div className="sm:col-span-2">
              <ImageUploader value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} label="Dish image" />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-3 rounded-xl border border-line bg-[#fcfaf6] p-4">
              <Toggle checked={form.available} onChange={(value) => setForm({ ...form, available: value })} label="Available to order" description="Unavailable dishes stay on the menu but cannot be ordered." />
              <Toggle checked={form.featured} onChange={(value) => setForm({ ...form, featured: value })} label="Featured dish" description="Give this item extra prominence in the workspace." />
            </div>
          </div>

          <div className="rounded-xl border border-line bg-[#fcfaf6] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-ink">Recipe & inventory</p>
                <p className="mt-0.5 text-xs leading-5 text-muted">When an order is completed, these quantities are deducted from live inventory.</p>
              </div>
              <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={addRecipeRow} disabled={!inventory.length}>Add ingredient</Button>
            </div>
            {!inventory.length && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-muted">Inventory items are not available for this account, or no stock items exist yet.</p>}
            {recipe.length > 0 && (
              <div className="mt-3 space-y-2">
                {recipe.map((entry, index) => (
                  <div key={`${entry.inventoryId}-${index}`} className="flex items-center gap-2">
                    <Select value={entry.inventoryId || ''} onChange={(event) => setRecipe((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, inventoryId: Number(event.target.value) } : row))} className="flex-1 text-xs">
                      <option value="">Choose inventory item</option>
                      {inventory.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.unit}</option>)}
                    </Select>
                    <Input type="number" min="0.01" step="0.01" value={entry.quantity} onChange={(event) => setRecipe((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Number(event.target.value) } : row))} className="w-24 text-xs" aria-label="Quantity" />
                    <button type="button" onClick={() => setRecipe((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="icon-btn h-9 w-9 hover:text-coral" aria-label="Remove ingredient"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}

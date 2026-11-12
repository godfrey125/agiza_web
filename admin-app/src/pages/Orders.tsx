import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Banknote, CalendarDays, Eye, Pencil, Plus, Receipt, ShoppingBag, Trash2, TrendingUp, Users,
} from 'lucide-react'
import { api } from '../lib/api'
import type { Customer, MenuItem, MenuResponse, OrderDetail, OrderListItem } from '../lib/types'
import { currency, formatDate, number } from '../lib/format'
import {
  Button, DateRangeFields, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal,
  PageHeader, Pagination, SearchInput, Select, StatusBadge, Tabs, Textarea, useToast,
} from '../components/ui'

const statusTabs = ['all', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']

interface Line { menuItemId: number | ''; quantity: number }
interface OrderFormState {
  guestMode: 'existing' | 'new'
  customerId: string
  customerName: string
  customerPhone: string
  customerEmail: string
  items: Line[]
  paymentMethod: string
  paymentStatus: string
  notes: string
  couponCode: string
  discount: string
}

const emptyForm: OrderFormState = {
  guestMode: 'existing', customerId: '', customerName: '', customerPhone: '', customerEmail: '',
  items: [{ menuItemId: '', quantity: 1 }], paymentMethod: 'Cash', paymentStatus: 'PENDING',
  notes: '', couponCode: '', discount: '',
}

interface OrdersResponse {
  items: OrderListItem[]
  total: number
  page: number
  pageSize: number
  summary: { total: number; pending: number; preparing: number; completed: number; cancelled: number; revenue: number }
}

export default function OrdersPage() {
  const [data, setData] = useState<OrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<OrderFormState>({ ...emptyForm })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [coupon, setCoupon] = useState<{ code: string; discount: number; name: string } | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const handled = useRef(false)

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '15', q: query, status, paymentStatus, sort })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const result = await api.get<OrdersResponse>(`/api/orders?${params.toString()}`)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders.')
    } finally {
      setLoading(false)
    }
  }, [page, query, status, paymentStatus, from, to, sort])

  const loadOptions = useCallback(async () => {
    try {
      const [customerData, menuData] = await Promise.all([
        api.get<{ items: Customer[] }>('/api/customers?pageSize=100&sort=name'),
        api.get<MenuResponse>('/api/menu?pageSize=500&sort=name'),
      ])
      setCustomers(customerData.items)
      setMenu(menuData.items)
    } catch { /* options remain empty if a permission is missing */ }
  }, [])

  useEffect(() => { loadOptions() }, [loadOptions])
  useEffect(() => {
    const timer = window.setTimeout(() => load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => { setPage(1) }, [query, status, paymentStatus, from, to, sort])

  const openCreate = useCallback(() => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      customerId: customers[0]?.id ? String(customers[0].id) : '',
      items: [{ menuItemId: menu.find((item) => item.available)?.id || '', quantity: 1 }],
    })
    setCoupon(null)
    setFormError('')
    setModalOpen(true)
  }, [customers, menu])

  const openEdit = useCallback(async (id: number) => {
    try {
      const result = await api.get<{ order: OrderDetail }>(`/api/orders/${id}`)
      const order = result.order
      setEditingId(order.id)
      setCoupon(null)
      setForm({
        guestMode: order.customerId ? 'existing' : 'new',
        customerId: order.customerId ? String(order.customerId) : '',
        customerName: order.customer.name === 'Walk-in customer' ? '' : order.customer.name,
        customerPhone: order.customer.phone || '',
        customerEmail: order.customer.email || '',
        items: order.items.map((item) => ({ menuItemId: item.menuItemId || '', quantity: item.quantity })),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        notes: order.notes || '',
        couponCode: '',
        discount: String(order.discount || ''),
      })
      setFormError('')
      setModalOpen(true)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open that order.', 'error')
    }
  }, [toast])

  useEffect(() => {
    if (handled.current) return
    const create = searchParams.get('new') === '1'
    const edit = searchParams.get('edit')
    if (!create && !edit) return
    handled.current = true
    if (create) openCreate()
    if (edit) openEdit(Number(edit))
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    next.delete('edit')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, openCreate, openEdit])

  const selectedLines = useMemo(() => form.items
    .map((line) => {
      const item = menu.find((entry) => entry.id === Number(line.menuItemId))
      return item ? { ...line, item, subtotal: item.price * line.quantity } : null
    })
    .filter(Boolean) as { item: MenuItem; quantity: number; subtotal: number; menuItemId: number | '' }[], [form.items, menu])

  const subtotal = selectedLines.reduce((sum, line) => sum + line.subtotal, 0)
  const discountValue = Math.min(subtotal, coupon ? coupon.discount : Number(form.discount) || 0)
  const tax = (subtotal - discountValue) * 0.05
  const total = subtotal - discountValue + tax

  const addLine = () => {
    setForm((current) => ({ ...current, items: [...current.items, { menuItemId: '', quantity: 1 }] }))
  }

  const updateLine = (index: number, patch: Partial<Line>) => {
    setForm((current) => ({ ...current, items: current.items.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line) }))
    setCoupon(null)
  }

  const removeLine = (index: number) => {
    setForm((current) => ({ ...current, items: current.items.length === 1 ? current.items : current.items.filter((_, lineIndex) => lineIndex !== index) }))
    setCoupon(null)
  }

  const applyCoupon = async () => {
    const code = form.couponCode.trim()
    if (!code) return setCoupon(null)
    setCouponLoading(true)
    try {
      const result = await api.post<{ coupon: { code: string; name: string }; discount: number }>('/api/coupons/validate', { code, subtotal })
      setCoupon({ code: result.coupon.code, name: result.coupon.name, discount: result.discount })
      toast(`Coupon ${result.coupon.code} applied.`, 'success')
    } catch (err) {
      setCoupon(null)
      toast(err instanceof Error ? err.message : 'Coupon could not be applied.', 'error')
    } finally {
      setCouponLoading(false)
    }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (form.guestMode === 'existing' && !form.customerId) return setFormError('Choose a guest or switch to a new guest.')
    if (form.guestMode === 'new' && !form.customerName.trim()) return setFormError('Enter the new guest’s name.')
    const validItems = form.items.filter((line) => line.menuItemId && line.quantity > 0)
    if (!validItems.length) return setFormError('Add at least one menu item.')
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        items: validItems,
        paymentMethod: form.paymentMethod,
        paymentStatus: form.paymentStatus,
        notes: form.notes,
        discount: Number(form.discount) || 0,
        couponCode: form.couponCode.trim() || undefined,
      }
      if (form.guestMode === 'existing') payload.customerId = Number(form.customerId)
      else {
        payload.customerName = form.customerName.trim()
        payload.customerPhone = form.customerPhone.trim()
        payload.customerEmail = form.customerEmail.trim()
      }
      if (editingId) {
        await api.put(`/api/orders/${editingId}`, payload)
        toast('Order updated.', 'success')
      } else {
        const result = await api.post<{ id: number; orderNumber: string }>('/api/orders', payload)
        toast(`${result.orderNumber} created.`, 'success')
      }
      setModalOpen(false)
      loadOptions()
      load(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the order.')
    } finally {
      setSaving(false)
    }
  }

  const summary = data?.summary
  const tabs = statusTabs.map((value) => ({
    id: value,
    label: value === 'all' ? 'All orders' : value[0] + value.slice(1).toLowerCase(),
    count: value === 'all' ? summary?.total : summary?.[value.toLowerCase() as keyof NonNullable<typeof summary>] as number | undefined,
  }))

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Orders' }]}
        eyebrow="Order desk"
        title="Orders"
        description="Take orders, move them through the kitchen, collect payment and keep every guest touchpoint connected."
        actions={<Button icon={<Plus size={16} />} onClick={openCreate}>New order</Button>}
      />

      {!loading && summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['All orders', summary.total, <Receipt size={16} />, 'text-primary'],
            ['Revenue', currency(summary.revenue), <Banknote size={16} />, 'text-success'],
            ['Preparing', summary.preparing, <ShoppingBag size={16} />, 'text-[#9A7214]'],
            ['Completed', summary.completed, <TrendingUp size={16} />, 'text-[#3569B4]'],
          ].map(([label, value, icon, tone]) => (
            <div key={String(label)} className="card flex items-center gap-3 p-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbf8f3] ${tone}`}>{icon as React.ReactNode}</span>
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label as string}</p><p className="mt-0.5 truncate font-display text-lg font-extrabold text-ink">{typeof value === 'number' ? number(value) : value}</p></div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4"><Tabs tabs={tabs} active={status} onChange={setStatus} /></div>

      <div className="card mb-5 flex flex-col gap-3 p-3.5 xl:flex-row xl:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Search order number, guest, phone…" />
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:justify-end">
          <Select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="text-xs xl:w-[140px]">
            <option value="all">Any payment</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="REFUNDED">Refunded</option>
            <option value="FAILED">Failed</option>
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value)} className="text-xs xl:w-[145px]">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="total_desc">Highest value</option>
            <option value="total_asc">Lowest value</option>
          </Select>
          <div className="col-span-2 flex items-center gap-1 sm:col-span-2">
            <DateRangeFields start={from} end={to} onStart={setFrom} onEnd={setTo} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-5"><LoadingBlock rows={8} /></div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Receipt size={24} />}
          title="No orders match this view"
          message="Try changing the status, payment or date filters, or create a new order for the next guest."
          action={<Button icon={<Plus size={15} />} onClick={openCreate}>New order</Button>}
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Order</th><th>Guest</th><th>Items</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {data.items.map((order) => (
                  <tr key={order.id}>
                    <td><Link to={`/orders/${order.id}`} className="font-bold text-primary hover:underline">{order.orderNumber}</Link></td>
                    <td>
                      <p className="table-primary">{order.customerName}</p>
                      <p className="table-secondary">{order.customerPhone || 'Walk-in guest'}</p>
                    </td>
                    <td>
                      <p className="text-xs font-medium text-ink">{number(order.itemCount)} item{order.itemCount === 1 ? '' : 's'}</p>
                      <p className="max-w-[240px] truncate text-[11px] text-muted">{order.itemNames}</p>
                    </td>
                    <td className="text-xs text-muted">{formatDate(order.date)}</td>
                    <td className="font-semibold text-ink">{currency(order.total)}</td>
                    <td><StatusBadge status={order.paymentStatus} /><span className="mt-1 block text-[10px] text-muted">{order.paymentMethod}</span></td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <Link to={`/orders/${order.id}`} className="icon-btn h-8 w-8" aria-label="View order"><Eye size={14} /></Link>
                        {['PENDING', 'CONFIRMED'].includes(order.status) && <button type="button" onClick={() => openEdit(order.id)} className="icon-btn h-8 w-8" aria-label="Edit order"><Pencil size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card mt-4 overflow-hidden"><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} /></div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit order' : 'Create an order'}
        description={editingId ? 'Change the guest, dishes, payment status or notes while the order is still pending or confirmed.' : 'Build the ticket from the live menu and attach it to an existing or new guest.'}
        width="max-w-4xl"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving} icon={<Receipt size={15} />}>{editingId ? 'Save order' : 'Create order'}</Button>
          </>
        )}
      >
        <form onSubmit={save} className="space-y-5">
          {formError && <div className="rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{formError}</div>}

          <div className="rounded-xl border border-line bg-[#fcfaf6] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><p className="text-sm font-bold text-ink">Guest</p><p className="text-xs text-muted">Attach this ticket to a guest or add a new one.</p></div>
              <div className="flex rounded-lg border border-line bg-white p-0.5">
                <button type="button" onClick={() => setForm((current) => ({ ...current, guestMode: 'existing' }))} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${form.guestMode === 'existing' ? 'bg-primary text-white' : 'text-muted'}`}>Existing</button>
                <button type="button" onClick={() => setForm((current) => ({ ...current, guestMode: 'new' }))} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${form.guestMode === 'new' ? 'bg-primary text-white' : 'text-muted'}`}>New guest</button>
              </div>
            </div>
            {form.guestMode === 'existing' ? (
              <Select value={form.customerId} onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}>
                <option value="">Choose a guest</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}
              </Select>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name" required><Input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="Guest name" /></Field>
                <Field label="Phone"><Input value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="+255 …" /></Field>
                <Field label="Email"><Input type="email" value={form.customerEmail} onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))} placeholder="guest@email.com" /></Field>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div><p className="text-sm font-bold text-ink">Order items</p><p className="text-xs text-muted">Prices come from the menu and are recorded on the order.</p></div>
              <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={addLine}>Add item</Button>
            </div>
            <div className="space-y-2">
              {form.items.map((line, index) => (
                <div key={index} className="flex items-center gap-2 rounded-xl border border-line bg-white p-2">
                  <Select value={line.menuItemId} onChange={(event) => updateLine(index, { menuItemId: Number(event.target.value) })} className="min-w-0 flex-1 text-xs">
                    <option value="">Choose a menu item</option>
                    {menu.map((item) => <option key={item.id} value={item.id}>{item.available ? '' : 'Unavailable · '}{item.name} · {currency(item.price)}</option>)}
                  </Select>
                  <Input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value) || 1) })} className="w-20 text-xs" aria-label="Quantity" />
                  <button type="button" onClick={() => removeLine(index)} disabled={form.items.length === 1} className="icon-btn h-9 w-9 hover:text-coral disabled:opacity-40" aria-label="Remove line"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment method">
              <Select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}>
                {['Cash', 'Card', 'M-Pesa', 'Airtel Money', 'Bank Transfer'].map((method) => <option key={method} value={method}>{method}</option>)}
              </Select>
            </Field>
            <Field label="Payment status">
              <Select value={form.paymentStatus} onChange={(event) => setForm((current) => ({ ...current, paymentStatus: event.target.value }))}>
                {['PENDING', 'PAID', 'REFUNDED', 'FAILED'].map((value) => <option key={value} value={value}>{value[0] + value.slice(1).toLowerCase()}</option>)}
              </Select>
            </Field>
            <Field label="Coupon code" hint="Optional. Applying a valid coupon overrides the manual discount.">
              <div className="flex gap-2">
                <Input value={form.couponCode} onChange={(event) => { setForm((current) => ({ ...current, couponCode: event.target.value.toUpperCase() })); setCoupon(null) }} placeholder="WELCOME10" />
                <Button variant="secondary" size="sm" onClick={applyCoupon} loading={couponLoading}>Apply</Button>
              </div>
            </Field>
            <Field label="Manual discount" hint={coupon ? `Coupon ${coupon.code} is applying ${currency(coupon.discount)}.` : 'Flat amount in Tanzania Shillings.'}>
              <Input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => { setForm((current) => ({ ...current, discount: event.target.value })); setCoupon(null) }} placeholder="0.00" disabled={Boolean(coupon)} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Allergies, delivery instructions, kitchen notes…" className="min-h-[76px]" />
            </Field>
          </div>

          <div className="rounded-xl border border-line bg-[#fcfaf6] p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span className="font-semibold text-ink">{currency(subtotal)}</span></div>
              <div className="flex justify-between text-muted"><span>Discount{coupon ? ` · ${coupon.code}` : ''}</span><span className="font-semibold text-success">−{currency(discountValue)}</span></div>
              <div className="flex justify-between text-muted"><span>Tax (5%)</span><span className="font-semibold text-ink">{currency(tax)}</span></div>
              <div className="flex justify-between border-t border-line pt-2 text-base"><span className="font-bold text-ink">Total</span><span className="font-display font-extrabold text-primary">{currency(total)}</span></div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}

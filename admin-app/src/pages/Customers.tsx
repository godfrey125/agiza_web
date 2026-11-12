import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Crown, Download, Eye, Pencil, Plus, Trash2, UserPlus, Users, UserX,
} from 'lucide-react'
import { api } from '../lib/api'
import type { Customer } from '../lib/types'
import { currency, formatDate, number } from '../lib/format'
import {
  Avatar, Button, EmptyState, ErrorState, Field, ImageUploader, Input, LoadingBlock,
  Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge, Textarea, useConfirm, useToast,
} from '../components/ui'

interface CustomersResponse {
  items: Customer[]
  total: number
  page: number
  pageSize: number
  summary: { total: number; new: number; returning: number; vip: number; inactive: number }
}

const empty = { name: '', email: '', phone: '', notes: '', type: 'NEW', imageUrl: '' }
const customerTypes = ['NEW', 'RETURNING', 'REGULAR', 'VIP', 'INACTIVE']

export default function CustomersPage() {
  const [data, setData] = useState<CustomersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState({ ...empty })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const toast = useToast()
  const confirm = useConfirm()

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '12', q: query, type, sort })
      const result = await api.get<CustomersResponse>(`/api/customers?${params.toString()}`)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load customers.')
    } finally {
      setLoading(false)
    }
  }, [page, query, type, sort])

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => { setPage(1) }, [query, type, sort])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...empty })
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (customer: Customer) => {
    setEditing(customer)
    setForm({
      name: customer.name, email: customer.email, phone: customer.phone,
      notes: customer.notes || '', type: customer.type, imageUrl: customer.imageUrl || '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (!form.name.trim()) return setFormError('Customer name is required.')
    setSaving(true)
    try {
      if (editing) await api.put(`/api/customers/${editing.id}`, form)
      else await api.post('/api/customers', form)
      toast(editing ? 'Customer updated.' : 'Customer added.', 'success')
      setModalOpen(false)
      load(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save this customer.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (customer: Customer) => {
    const ok = await confirm({
      title: 'Delete customer?',
      message: `“${customer.name}” will be removed. Their existing orders stay in reporting but will no longer be linked to a guest profile.`,
      confirmLabel: 'Delete customer',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/api/customers/${customer.id}`)
      toast('Customer deleted.', 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete the customer.', 'error')
    }
  }

  const exportCsv = () => api.download('/api/customers/export/csv', 'customers.csv').catch((err) => toast(err.message, 'error'))
  const summary = data?.summary

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Customers' }]}
        eyebrow="Guest book"
        title="Customers"
        description="Know who keeps coming back, what they love and how much value they bring to the restaurant."
        actions={(
          <>
            <Button variant="secondary" icon={<Download size={15} />} onClick={exportCsv}>Export CSV</Button>
            <Button icon={<Plus size={16} />} onClick={openCreate}>Add customer</Button>
          </>
        )}
      />

      {!loading && summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['All customers', summary.total, <Users size={16} />, 'text-primary'],
            ['New · 30 days', summary.new, <UserPlus size={16} />, 'text-success'],
            ['VIP guests', summary.vip, <Crown size={16} />, 'text-[#9A7214]'],
            ['Inactive', summary.inactive, <UserX size={16} />, 'text-coral'],
          ].map(([label, value, icon, tone]) => (
            <div key={String(label)} className="card flex items-center gap-3 p-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbf8f3] ${tone}`}>{icon as React.ReactNode}</span>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label as string}</p><p className="mt-0.5 font-display text-lg font-extrabold text-ink">{number(Number(value))}</p></div>
            </div>
          ))}
        </div>
      )}

      <div className="card mb-5 flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Search guests, phone, email…" />
        <div className="grid flex-1 grid-cols-2 gap-2 lg:flex lg:justify-end">
          <Select value={type} onChange={(event) => setType(event.target.value)} className="text-xs lg:w-[145px]">
            <option value="all">All guest types</option>
            {customerTypes.map((value) => <option key={value} value={value}>{value[0] + value.slice(1).toLowerCase()}</option>)}
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value)} className="text-xs lg:w-[155px]">
            <option value="newest">Newest guests</option>
            <option value="name">Name A–Z</option>
            <option value="spend">Highest spend</option>
            <option value="orders">Most orders</option>
            <option value="last_order">Recent orders</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="card p-5"><LoadingBlock rows={8} /></div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Users size={24} />}
          title="No guests match this view"
          message="Try a different search or guest type, or add a guest profile manually."
          action={<Button icon={<Plus size={15} />} onClick={openCreate}>Add customer</Button>}
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Guest</th><th>Type</th><th>Orders</th><th>Total spend</th><th>Last order</th><th>Joined</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {data.items.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar src={customer.imageUrl} name={customer.name} size={38} />
                        <div className="min-w-0">
                          <Link to={`/customers/${customer.id}`} className="table-primary hover:text-primary">{customer.name}</Link>
                          <p className="table-secondary">{customer.phone || customer.email || 'No contact details'}</p>
                        </div>
                      </div>
                    </td>
                    <td><StatusBadge status={customer.type} /></td>
                    <td><p className="font-semibold text-ink">{number(customer.totalOrders)}</p><p className="text-[10px] text-muted">{currency(customer.averageOrder)} avg</p></td>
                    <td className="font-semibold text-ink">{currency(customer.totalSpend)}</td>
                    <td className="text-xs text-muted">{customer.lastOrder ? formatDate(customer.lastOrder) : 'No orders yet'}</td>
                    <td className="text-xs text-muted">{formatDate(customer.createdAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <Link to={`/customers/${customer.id}`} className="icon-btn h-8 w-8" aria-label="View customer"><Eye size={14} /></Link>
                        <button type="button" onClick={() => openEdit(customer)} className="icon-btn h-8 w-8" aria-label="Edit customer"><Pencil size={14} /></button>
                        <button type="button" onClick={() => remove(customer)} className="icon-btn h-8 w-8 hover:text-coral" aria-label="Delete customer"><Trash2 size={14} /></button>
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

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="card p-4"><p className="text-xs font-bold text-ink">Guest tiers are calculated</p><p className="mt-1 text-[11px] leading-5 text-muted">VIP, regular, returning and inactive labels use real order count, spend and recency.</p></div>
        <div className="card p-4"><p className="text-xs font-bold text-ink">Order history follows the guest</p><p className="mt-1 text-[11px] leading-5 text-muted">Every order profile shows favourites, reviews and spend in one place.</p></div>
        <div className="card p-4"><p className="text-xs font-bold text-ink">Campaign audiences</p><p className="mt-1 text-[11px] leading-5 text-muted">Marketing uses the same customer base for VIP and inactive audience planning.</p></div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit customer' : 'Add customer'}
        description="Keep guest contact details and private notes in one place."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving} icon={<Users size={15} />}>{editing ? 'Save changes' : 'Add customer'}</Button>
          </>
        )}
      >
        <form onSubmit={save} className="space-y-4">
          {formError && <div className="rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{formError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required className="sm:col-span-2"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Guest name" /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="guest@email.com" /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+255 …" /></Field>
            <Field label="Guest type">
              <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{customerTypes.map((value) => <option key={value} value={value}>{value[0] + value.slice(1).toLowerCase()}</option>)}</Select>
            </Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Preferences, allergies, special occasions…" /></Field>
            <div className="sm:col-span-2"><ImageUploader value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} label="Guest photo" /></div>
          </div>
        </form>
      </Modal>
    </div>
  )
}

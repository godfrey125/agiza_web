import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine, ArrowUpFromLine, Boxes, Download, Package, Pencil, Plus, RefreshCw,
  SlidersHorizontal, Trash2, Truck, Warehouse,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { InventoryItem, InventoryResponse, Supplier } from '../lib/types'
import { currency, formatDate, formatDateTime, number } from '../lib/format'
import {
  Button, EmptyState, ErrorState, Field, ImageUploader, Input, LoadingBlock, Modal,
  PageHeader, SearchInput, Select, StatusBadge, Tabs, Textarea, useConfirm, useToast,
} from '../components/ui'

type Tab = 'items' | 'suppliers' | 'movements'

interface Movement {
  id: number
  itemName: string
  unit: string
  type: string
  quantity: number
  previousQuantity: number
  newQuantity: number
  reason: string
  staffName: string
  createdAt: string
}

const emptyItem = {
  name: '', sku: '', category: 'Ingredients', quantity: '0', unit: 'kg',
  minStock: '0', unitCost: '0', supplierId: '', imageUrl: '',
}
const emptySupplier = { name: '', contactPerson: '', phone: '', email: '', address: '', products: '' }

const movementLabels: Record<string, string> = {
  ADD: 'Stock added', PURCHASE: 'Purchase', REMOVE: 'Stock removed', ADJUST: 'Adjustment', ORDER_CONSUMPTION: 'Order consumption',
}

export default function InventoryPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('inventory.manage')
  const [tab, setTab] = useState<Tab>('items')
  const [data, setData] = useState<InventoryResponse | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [itemModal, setItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [itemForm, setItemForm] = useState({ ...emptyItem })
  const [itemError, setItemError] = useState('')
  const [savingItem, setSavingItem] = useState(false)
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null)
  const [adjustForm, setAdjustForm] = useState({ type: 'ADD', quantity: '1', reason: '', unitCost: '' })
  const [adjustError, setAdjustError] = useState('')
  const [savingAdjust, setSavingAdjust] = useState(false)
  const [supplierModal, setSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [supplierForm, setSupplierForm] = useState({ ...emptySupplier })
  const [supplierError, setSupplierError] = useState('')
  const [savingSupplier, setSavingSupplier] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ q: query, category, status })
      const [inventoryData, supplierData] = await Promise.all([
        api.get<InventoryResponse>(`/api/inventory?${params.toString()}`),
        api.get<{ suppliers: Supplier[] }>('/api/suppliers'),
      ])
      setData(inventoryData)
      setSuppliers(supplierData.suppliers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load inventory.')
    } finally {
      setLoading(false)
    }
  }, [query, category, status])

  const loadMovements = useCallback(async () => {
    try {
      const result = await api.get<{ movements: Movement[] }>('/api/inventory/movements')
      setMovements(result.movements)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not load stock movements.', 'error')
    }
  }, [toast])

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 220)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => { if (tab === 'movements') loadMovements() }, [tab, loadMovements])

  const categories = data?.categories || []
  const summary = data?.summary

  const openItemCreate = () => {
    setEditingItem(null)
    setItemForm({ ...emptyItem, supplierId: suppliers[0]?.id ? String(suppliers[0].id) : '' })
    setItemError('')
    setItemModal(true)
  }

  const openItemEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setItemForm({
      name: item.name, sku: item.sku, category: item.category, quantity: String(item.quantity),
      unit: item.unit, minStock: String(item.minStock), unitCost: String(item.unitCost),
      supplierId: item.supplierId ? String(item.supplierId) : '', imageUrl: item.imageUrl || '',
    })
    setItemError('')
    setItemModal(true)
  }

  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault()
    setItemError('')
    if (!itemForm.name.trim() || !itemForm.sku.trim() || !itemForm.unit.trim()) return setItemError('Name, SKU and unit are required.')
    setSavingItem(true)
    try {
      const payload = {
        ...itemForm,
        quantity: Number(itemForm.quantity) || 0,
        minStock: Number(itemForm.minStock) || 0,
        unitCost: Number(itemForm.unitCost) || 0,
        supplierId: itemForm.supplierId ? Number(itemForm.supplierId) : null,
      }
      if (editingItem) await api.put(`/api/inventory/${editingItem.id}`, payload)
      else await api.post('/api/inventory', payload)
      toast(editingItem ? 'Inventory item updated.' : 'Inventory item added.', 'success')
      setItemModal(false)
      load(false)
    } catch (err) {
      setItemError(err instanceof Error ? err.message : 'Could not save the inventory item.')
    } finally {
      setSavingItem(false)
    }
  }

  const openAdjust = (item: InventoryItem) => {
    setAdjusting(item)
    setAdjustForm({ type: 'ADD', quantity: '1', reason: '', unitCost: String(item.unitCost) })
    setAdjustError('')
  }

  const saveAdjust = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!adjusting) return
    if (!adjustForm.quantity || Number(adjustForm.quantity) < 0) return setAdjustError('Enter a valid quantity.')
    if (adjustForm.reason.trim().length < 3) return setAdjustError('Add a short reason for the movement.')
    setSavingAdjust(true)
    setAdjustError('')
    try {
      await api.post(`/api/inventory/${adjusting.id}/stock`, {
        type: adjustForm.type,
        quantity: Number(adjustForm.quantity),
        reason: adjustForm.reason,
        unitCost: adjustForm.type === 'PURCHASE' ? Number(adjustForm.unitCost) : undefined,
      })
      toast('Stock movement recorded.', 'success')
      setAdjusting(null)
      load(false)
      if (tab === 'movements') loadMovements()
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Could not record the stock movement.')
    } finally {
      setSavingAdjust(false)
    }
  }

  const removeItem = async (item: InventoryItem) => {
    const ok = await confirm({ title: 'Delete inventory item?', message: `“${item.name}” will be removed from stock. Existing stock movements stay in history.`, confirmLabel: 'Delete item', tone: 'danger' })
    if (!ok) return
    try {
      await api.delete(`/api/inventory/${item.id}`)
      toast('Inventory item deleted.', 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete the item.', 'error')
    }
  }

  const openSupplierCreate = () => {
    setEditingSupplier(null)
    setSupplierForm({ ...emptySupplier })
    setSupplierError('')
    setSupplierModal(true)
  }

  const openSupplierEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setSupplierForm({
      name: supplier.name, contactPerson: supplier.contactPerson, phone: supplier.phone,
      email: supplier.email, address: supplier.address, products: supplier.products,
    })
    setSupplierError('')
    setSupplierModal(true)
  }

  const saveSupplier = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supplierForm.name.trim()) return setSupplierError('Supplier name is required.')
    setSavingSupplier(true)
    setSupplierError('')
    try {
      if (editingSupplier) await api.put(`/api/suppliers/${editingSupplier.id}`, supplierForm)
      else await api.post('/api/suppliers', supplierForm)
      toast(editingSupplier ? 'Supplier updated.' : 'Supplier added.', 'success')
      setSupplierModal(false)
      load(false)
    } catch (err) {
      setSupplierError(err instanceof Error ? err.message : 'Could not save the supplier.')
    } finally {
      setSavingSupplier(false)
    }
  }

  const removeSupplier = async (supplier: Supplier) => {
    const ok = await confirm({ title: 'Delete supplier?', message: supplier.itemCount > 0 ? `${supplier.name} supplies ${supplier.itemCount} inventory item${supplier.itemCount === 1 ? '' : 's'}. Those items will become unassigned.` : `${supplier.name} will be removed from the supplier list.`, confirmLabel: 'Delete supplier', tone: 'danger' })
    if (!ok) return
    try {
      await api.delete(`/api/suppliers/${supplier.id}`)
      toast('Supplier deleted.', 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete the supplier.', 'error')
    }
  }

  const tabs = useMemo(() => [
    { id: 'items', label: 'Stock items', count: data?.items.length || 0 },
    { id: 'suppliers', label: 'Suppliers', count: suppliers.length },
    { id: 'movements', label: 'Movements', count: movements.length || undefined },
  ], [data, suppliers.length, movements.length])

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Inventory' }]}
        eyebrow="Stock room"
        title="Inventory"
        description="Track ingredients, packaging and supplier stock — with recipe-level consumption when orders are completed."
        actions={(
          <>
            <Button variant="secondary" icon={<Download size={15} />} onClick={() => api.download('/api/inventory/export/csv', 'inventory.csv').catch((err) => toast(err.message, 'error'))}>Export CSV</Button>
            {canManage && tab === 'suppliers'
              ? <Button icon={<Plus size={15} />} onClick={openSupplierCreate}>Add supplier</Button>
              : canManage ? <Button icon={<Plus size={15} />} onClick={openItemCreate}>Add stock item</Button> : null}
          </>
        )}
      />

      {!loading && summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Stock items', summary.items, <Boxes size={16} />, 'text-primary'],
            ['Low stock', summary.low, <ArrowDownToLine size={16} />, 'text-[#9A7214]'],
            ['Out of stock', summary.out, <Package size={16} />, 'text-coral'],
            ['Stock value', currency(summary.value), <Warehouse size={16} />, 'text-success'],
          ].map(([label, value, icon, tone]) => (
            <div key={String(label)} className="card flex items-center gap-3 p-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbf8f3] ${tone}`}>{icon as React.ReactNode}</span>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label as string}</p><p className="mt-0.5 truncate font-display text-lg font-extrabold text-ink">{typeof value === 'number' ? number(value) : value}</p></div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4"><Tabs tabs={tabs} active={tab} onChange={(value) => setTab(value as Tab)} /></div>

      {tab === 'items' && (
        <>
          <div className="card mb-5 flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center">
            <SearchInput value={query} onChange={setQuery} placeholder="Search item, SKU or category…" />
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:justify-end">
              <Select value={category} onChange={(event) => setCategory(event.target.value)} className="text-xs lg:w-[150px]">
                <option value="all">All categories</option>
                {categories.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
              <Select value={status} onChange={(event) => setStatus(event.target.value)} className="text-xs lg:w-[140px]">
                <option value="all">Any stock level</option>
                <option value="OK">Healthy</option>
                <option value="LOW">Low</option>
                <option value="OUT">Out</option>
                <option value="OVER">Overstocked</option>
              </Select>
              <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={() => load(false)}>Refresh</Button>
            </div>
          </div>

          {loading ? <div className="card p-5"><LoadingBlock rows={8} /></div> : error ? <ErrorState message={error} onRetry={() => load()} /> : !data?.items.length ? (
            <EmptyState icon={<Boxes size={24} />} title="No stock items match" message="Change the search or filters, or add an inventory item to start tracking stock." action={canManage ? <Button icon={<Plus size={15} />} onClick={openItemCreate}>Add stock item</Button> : undefined} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Item</th><th>Stock level</th><th>Min</th><th>Unit cost</th><th>Value</th><th>Supplier</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {data.items.map((item) => {
                    const ratio = item.minStock > 0 ? Math.min(100, (item.quantity / (item.minStock * 2)) * 100) : Math.min(100, item.quantity * 4)
                    return (
                      <tr key={item.id}>
                        <td><p className="table-primary">{item.name}</p><p className="table-secondary">{item.sku} · {item.category}</p></td>
                        <td>
                          <p className="font-semibold text-ink">{number(item.quantity)} <span className="text-xs font-normal text-muted">{item.unit}</span></p>
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-[#f3eee7]"><div className={`h-full rounded-full ${item.status === 'OUT' ? 'bg-coral' : item.status === 'LOW' ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.max(2, ratio)}%` }} /></div>
                        </td>
                        <td>{number(item.minStock)} {item.unit}</td>
                        <td>{currency(item.unitCost)}</td>
                        <td className="font-semibold text-ink">{currency(item.value)}</td>
                        <td className="max-w-[150px] truncate text-xs text-muted">{item.supplierName || 'Unassigned'}</td>
                        <td><StatusBadge status={item.status} /></td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            {canManage && <button type="button" onClick={() => openAdjust(item)} className="icon-btn h-8 w-8 text-primary" aria-label="Adjust stock" title="Adjust stock"><ArrowUpFromLine size={14} /></button>}
                            {canManage && <button type="button" onClick={() => openItemEdit(item)} className="icon-btn h-8 w-8" aria-label="Edit item"><Pencil size={14} /></button>}
                            {canManage && <button type="button" onClick={() => removeItem(item)} className="icon-btn h-8 w-8 hover:text-coral" aria-label="Delete item"><Trash2 size={14} /></button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-col items-start justify-between gap-2 rounded-xl border border-[#f2e3d8] bg-[linear-gradient(100deg,#FFF6EF,#FFFDF9)] px-4 py-3 text-xs sm:flex-row sm:items-center">
            <p className="leading-5 text-muted"><span className="font-semibold text-ink">Automatic consumption:</span> completing an order deducts each recipe ingredient and records a stock movement.</p>
            <span className="font-semibold text-primary">{summary ? `${summary.low} low · ${summary.out} out` : ''}</span>
          </div>
        </>
      )}

      {tab === 'suppliers' && (
        <div className="space-y-4">
          {suppliers.length ? suppliers.map((supplier) => (
            <div key={supplier.id} className="card p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-soft-yellow text-[#9A7214]"><Truck size={19} /></span>
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-ink">{supplier.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{supplier.contactPerson || 'No contact person'} · {supplier.phone || 'No phone'}</p>
                    <p className="mt-1 max-w-2xl truncate text-[11px] text-muted">{supplier.address || 'No address'} · {supplier.products || 'No product list'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-5 text-center">
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Items</p><p className="mt-0.5 font-display text-lg font-extrabold text-ink">{number(supplier.itemCount)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Stock value</p><p className="mt-0.5 font-display text-lg font-extrabold text-primary">{currency(supplier.stockValue)}</p></div>
                  {canManage && <div className="flex gap-1.5"><button type="button" onClick={() => openSupplierEdit(supplier)} className="icon-btn h-8 w-8" aria-label="Edit supplier"><Pencil size={14} /></button><button type="button" onClick={() => removeSupplier(supplier)} className="icon-btn h-8 w-8 hover:text-coral" aria-label="Delete supplier"><Trash2 size={14} /></button></div>}
                </div>
              </div>
            </div>
          )) : <EmptyState icon={<Truck size={24} />} title="No suppliers yet" message="Add suppliers to connect stock items to the people who deliver them." action={canManage ? <Button icon={<Plus size={15} />} onClick={openSupplierCreate}>Add supplier</Button> : undefined} />}
        </div>
      )}

      {tab === 'movements' && (
        <div className="table-wrap">
          {movements.length ? (
            <table className="data-table min-w-[760px]">
              <thead><tr><th>Item</th><th>Type</th><th>Change</th><th>Previous → new</th><th>Reason</th><th>Staff</th><th>Date</th></tr></thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="font-semibold text-ink">{movement.itemName}</td>
                    <td><StatusBadge status={movementLabels[movement.type] || movement.type} /></td>
                    <td className={movement.quantity < 0 ? 'font-semibold text-coral' : 'font-semibold text-success'}>{movement.quantity > 0 ? '+' : ''}{number(movement.quantity)} {movement.unit}</td>
                    <td className="text-xs text-muted">{number(movement.previousQuantity)} → {number(movement.newQuantity)}</td>
                    <td className="max-w-[250px] truncate text-xs text-[#5f5a53]">{movement.reason}</td>
                    <td className="text-xs text-muted">{movement.staffName || 'System'}</td>
                    <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(movement.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="p-5"><LoadingBlock rows={6} /></div>}
        </div>
      )}

      <Modal open={itemModal} onClose={() => setItemModal(false)} title={editingItem ? 'Edit inventory item' : 'Add inventory item'} description="Stock levels, reorder minimums and supplier assignment." width="max-w-2xl"
        footer={<><Button variant="secondary" onClick={() => setItemModal(false)}>Cancel</Button><Button onClick={saveItem} loading={savingItem}>{editingItem ? 'Save changes' : 'Add item'}</Button></>}>
        <form onSubmit={saveItem} className="space-y-4">
          {itemError && <div className="rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{itemError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Item name" required><Input value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} placeholder="e.g. Paneer" /></Field>
            <Field label="SKU" required><Input value={itemForm.sku} onChange={(event) => setItemForm({ ...itemForm, sku: event.target.value })} placeholder="INV-031" /></Field>
            <Field label="Category"><Input value={itemForm.category} onChange={(event) => setItemForm({ ...itemForm, category: event.target.value })} placeholder="Dairy" /></Field>
            <Field label="Unit" required><Input value={itemForm.unit} onChange={(event) => setItemForm({ ...itemForm, unit: event.target.value })} placeholder="kg / L / pcs" /></Field>
            {!editingItem && <Field label="Opening quantity"><Input type="number" min="0" step="0.01" value={itemForm.quantity} onChange={(event) => setItemForm({ ...itemForm, quantity: event.target.value })} /></Field>}
            <Field label="Minimum stock"><Input type="number" min="0" step="0.01" value={itemForm.minStock} onChange={(event) => setItemForm({ ...itemForm, minStock: event.target.value })} /></Field>
            <Field label="Unit cost"><Input type="number" min="0" step="0.01" value={itemForm.unitCost} onChange={(event) => setItemForm({ ...itemForm, unitCost: event.target.value })} /></Field>
            <Field label="Supplier"><Select value={itemForm.supplierId} onChange={(event) => setItemForm({ ...itemForm, supplierId: event.target.value })}><option value="">Unassigned</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</Select></Field>
            <div className="sm:col-span-2"><ImageUploader value={itemForm.imageUrl} onChange={(url) => setItemForm({ ...itemForm, imageUrl: url })} label="Item image" /></div>
          </div>
          {editingItem && <p className="rounded-xl bg-[#fbf8f3] px-3.5 py-2.5 text-[11px] leading-5 text-muted">To change quantity, use <button type="button" onClick={() => { setItemModal(false); openAdjust(editingItem) }} className="font-semibold text-primary hover:underline">Adjust stock</button> so the movement is recorded.</p>}
        </form>
      </Modal>

      <Modal open={Boolean(adjusting)} onClose={() => setAdjusting(null)} title={adjusting ? `Adjust ${adjusting.name}` : 'Adjust stock'} description="Every change is recorded in the stock movement ledger." width="max-w-lg"
        footer={<><Button variant="secondary" onClick={() => setAdjusting(null)}>Cancel</Button><Button onClick={saveAdjust} loading={savingAdjust} icon={<SlidersHorizontal size={14} />}>Record movement</Button></>}>
        {adjusting && (
          <form onSubmit={saveAdjust} className="space-y-4">
            {adjustError && <div className="rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{adjustError}</div>}
            <div className="rounded-xl bg-[#fbf8f3] p-3.5 text-xs"><span className="text-muted">Current stock</span><p className="mt-1 font-display text-xl font-extrabold text-ink">{number(adjusting.quantity)} <span className="text-sm font-semibold text-muted">{adjusting.unit}</span></p></div>
            <Field label="Movement type"><Select value={adjustForm.type} onChange={(event) => setAdjustForm({ ...adjustForm, type: event.target.value })}><option value="ADD">Add stock</option><option value="PURCHASE">Purchase delivery</option><option value="REMOVE">Remove stock</option><option value="ADJUST">Set exact quantity</option></Select></Field>
            <Field label={adjustForm.type === 'ADJUST' ? 'New quantity' : 'Quantity'} required><Input type="number" min="0" step="0.01" value={adjustForm.quantity} onChange={(event) => setAdjustForm({ ...adjustForm, quantity: event.target.value })} /></Field>
            {adjustForm.type === 'PURCHASE' && <Field label="New unit cost" hint="Optional. Updates the item's cost price."><Input type="number" min="0" step="0.01" value={adjustForm.unitCost} onChange={(event) => setAdjustForm({ ...adjustForm, unitCost: event.target.value })} /></Field>}
            <Field label="Reason" required><Textarea value={adjustForm.reason} onChange={(event) => setAdjustForm({ ...adjustForm, reason: event.target.value })} placeholder="e.g. Weekly dairy delivery, spoilage write-off…" /></Field>
          </form>
        )}
      </Modal>

      <Modal open={supplierModal} onClose={() => setSupplierModal(false)} title={editingSupplier ? 'Edit supplier' : 'Add supplier'} description="Contact details and the products they supply." width="max-w-2xl"
        footer={<><Button variant="secondary" onClick={() => setSupplierModal(false)}>Cancel</Button><Button onClick={saveSupplier} loading={savingSupplier}>{editingSupplier ? 'Save changes' : 'Add supplier'}</Button></>}>
        <form onSubmit={saveSupplier} className="space-y-4">
          {supplierError && <div className="rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{supplierError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier name" required><Input value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} /></Field>
            <Field label="Contact person"><Input value={supplierForm.contactPerson} onChange={(event) => setSupplierForm({ ...supplierForm, contactPerson: event.target.value })} /></Field>
            <Field label="Phone"><Input value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} /></Field>
            <Field label="Address" className="sm:col-span-2"><Input value={supplierForm.address} onChange={(event) => setSupplierForm({ ...supplierForm, address: event.target.value })} /></Field>
            <Field label="Products supplied" className="sm:col-span-2"><Input value={supplierForm.products} onChange={(event) => setSupplierForm({ ...supplierForm, products: event.target.value })} placeholder="Vegetables, fruit, salad greens" /></Field>
          </div>
        </form>
      </Modal>
    </div>
  )
}

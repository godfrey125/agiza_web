import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, CalendarDays, CheckCircle2, CreditCard, Download, Pencil, Printer,
  RefreshCw, UserRound, XCircle,
} from 'lucide-react'
import { api } from '../lib/api'
import type { OrderDetail } from '../lib/types'
import { currency, formatDate, formatDateTime, number, titleCase } from '../lib/format'
import {
  Avatar, Button, ErrorState, Field, FoodImage, PageHeader, SectionCard, Select, StatusBadge,
  Textarea, useConfirm, useToast,
} from '../components/ui'

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [paymentStatus, setPaymentStatus] = useState('PENDING')
  const [notes, setNotes] = useState('')
  const toast = useToast()
  const confirm = useConfirm()

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const result = await api.get<{ order: OrderDetail }>(`/api/orders/${id}`)
      setOrder(result.order)
      setPaymentMethod(result.order.paymentMethod)
      setPaymentStatus(result.order.paymentStatus)
      setNotes(result.order.notes || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this order.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const updateStatus = async (status: string) => {
    if (!order) return
    if (status === 'CANCELLED') {
      const ok = await confirm({ title: 'Cancel this order?', message: `${order.orderNumber} will be marked cancelled. Ingredients are not consumed for cancelled orders.`, confirmLabel: 'Cancel order', tone: 'danger' })
      if (!ok) return
    }
    setBusy(status)
    try {
      await api.patch(`/api/orders/${order.id}/status`, { status })
      toast(`Order moved to ${titleCase(status).toLowerCase()}.`, 'success')
      await load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not change the order status.', 'error')
    } finally {
      setBusy('')
    }
  }

  const savePayment = async () => {
    if (!order) return
    setBusy('payment')
    try {
      await api.put(`/api/orders/${order.id}`, { paymentMethod, paymentStatus })
      toast('Payment details saved.', 'success')
      await load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save payment details.', 'error')
    } finally {
      setBusy('')
    }
  }

  const saveNotes = async () => {
    if (!order) return
    setBusy('notes')
    try {
      await api.put(`/api/orders/${order.id}`, { notes })
      toast('Order notes saved.', 'success')
      await load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save notes.', 'error')
    } finally {
      setBusy('')
    }
  }

  const printReceipt = () => {
    if (!order) return
    const win = window.open('', '_blank', 'width=820,height=960')
    if (!win) return toast('Allow pop-ups to print the receipt.', 'warning')
    win.document.write(`<!doctype html><html><head><title>${escapeHtml(order.orderNumber)} receipt</title>
      <style>
        *{box-sizing:border-box} body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#252525;margin:0;padding:36px;background:#fff}
        .head{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #F05A32;padding-bottom:18px;margin-bottom:22px}
        h1{font-size:24px;margin:0;color:#F05A32} h2{font-size:18px;margin:0 0 4px} .muted{color:#777;font-size:12px;line-height:1.7}
        .box{border:1px solid #EEE9E2;border-radius:12px;padding:14px 16px;margin-bottom:18px}
        table{width:100%;border-collapse:collapse;margin-bottom:18px} th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#777;text-align:left;padding:8px 0;border-bottom:1px solid #EEE9E2}
        td{padding:10px 0;border-bottom:1px solid #f3efe8;font-size:13px;vertical-align:top} .right{text-align:right}.totals{width:280px;margin-left:auto}
        .totals div{display:flex;justify-content:space-between;padding:5px 0;color:#777;font-size:13px}.totals .grand{border-top:2px solid #EEE9E2;margin-top:8px;padding-top:10px;color:#252525;font-weight:800;font-size:17px}
        .grand span:last-child{color:#F05A32}.pill{display:inline-block;padding:3px 8px;border-radius:999px;background:#FFF0E8;color:#F05A32;font-size:10px;font-weight:700;text-transform:uppercase}
        .footer{text-align:center;color:#999;font-size:11px;margin-top:28px;border-top:1px solid #EEE9E2;padding-top:16px}
      </style></head><body>
      <div class="head"><div><h1>Agiza Admin</h1><div class="muted">Platform control center<br>Warm food, clear numbers.</div></div><div style="text-align:right"><h2>${escapeHtml(order.orderNumber)}</h2><div class="muted">${escapeHtml(formatDateTime(order.createdAt))}<br><span class="pill">${escapeHtml(order.status)}</span></div></div></div>
      <div class="box"><div style="display:flex;justify-content:space-between;gap:20px"><div><div class="muted">Guest</div><strong>${escapeHtml(order.customer.name || 'Walk-in customer')}</strong><div class="muted">${escapeHtml(order.customer.phone || order.customer.email || '')}</div></div><div style="text-align:right"><div class="muted">Served by</div><strong>${escapeHtml(order.staffName)}</strong><div class="muted">${escapeHtml(order.paymentMethod)} · ${escapeHtml(order.paymentStatus)}</div></div></div></div>
      <table><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead><tbody>
      ${order.items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td class="right">${item.quantity}</td><td class="right">${currency(item.price)}</td><td class="right">${currency(item.subtotal)}</td></tr>`).join('')}
      </tbody></table>
      <div class="totals"><div><span>Subtotal</span><span>${currency(order.subtotal)}</span></div><div><span>Discount</span><span>−${currency(order.discount)}</span></div><div><span>Tax</span><span>${currency(order.tax)}</span></div><div class="grand"><span>Total</span><span>${currency(order.total)}</span></div></div>
      ${order.notes ? `<div class="box" style="margin-top:22px"><div class="muted">Notes</div>${escapeHtml(order.notes)}</div>` : ''}
      <div class="footer">Thank you for dining with us. Generated by Agiza Admin · ${escapeHtml(formatDateTime(new Date()))}</div>
      </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  if (loading) return <div className="space-y-4"><div className="skeleton h-8 w-64" /><div className="skeleton h-[520px] rounded-2xl" /></div>
  if (error || !order) return <ErrorState message={error || 'Order not found.'} onRetry={() => load()} />

  const canEdit = ['PENDING', 'CONFIRMED'].includes(order.status)
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Orders', href: '/orders' }, { label: order.orderNumber }]}
        eyebrow="Order detail"
        title={order.orderNumber}
        description={`${formatDateTime(order.createdAt)} · ${order.customer.name || 'Walk-in customer'} · ${order.items.length} line item${order.items.length === 1 ? '' : 's'}`}
        actions={(
          <>
            <Button variant="secondary" icon={<ArrowLeft size={15} />} onClick={() => navigate('/orders')}>Back</Button>
            <Button variant="secondary" icon={<Printer size={15} />} onClick={printReceipt}>Print receipt</Button>
            <Button variant="secondary" icon={<Download size={15} />} onClick={() => api.download(`/api/orders/${order.id}/invoice?format=pdf`, `${order.orderNumber}.pdf`).catch((err) => toast(err.message, 'error'))}>Invoice PDF</Button>
            {canEdit && <Link to={`/orders?edit=${order.id}`} className="btn-primary"><Pencil size={15} /> Edit order</Link>}
          </>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          <SectionCard title="Order items" description="Prices and quantities recorded on this ticket." bodyClassName="p-0">
            <div className="table-wrap rounded-none border-0">
              <table className="data-table min-w-[620px]">
                <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th className="text-right">Subtotal</th></tr></thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <FoodImage src={item.imageUrl} alt={item.name} className="h-11 w-11 shrink-0" />
                          <div><p className="font-semibold text-ink">{item.name}</p><p className="text-[10px] text-muted">{item.menuItemId ? 'Menu item' : 'Custom line'}</p></div>
                        </div>
                      </td>
                      <td>{currency(item.price)}</td>
                      <td>{number(item.quantity)}</td>
                      <td className="text-right font-semibold text-ink">{currency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto w-full max-w-[330px] space-y-2.5 p-5 text-sm">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span className="font-semibold text-ink">{currency(order.subtotal)}</span></div>
              <div className="flex justify-between text-muted"><span>Discount</span><span className="font-semibold text-success">−{currency(order.discount)}</span></div>
              <div className="flex justify-between text-muted"><span>Tax</span><span className="font-semibold text-ink">{currency(order.tax)}</span></div>
              <div className="flex items-center justify-between border-t border-line pt-3"><span className="font-display text-base font-bold text-ink">Total</span><span className="font-display text-2xl font-extrabold text-primary">{currency(order.total)}</span></div>
            </div>
          </SectionCard>

          <div className="grid gap-5 md:grid-cols-2">
            <SectionCard title="Guest" description="Who this order belongs to.">
              <div className="flex items-center gap-3">
                <Avatar src={order.customer.imageUrl} name={order.customer.name} size={46} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{order.customer.name || 'Walk-in customer'}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{order.customer.phone || order.customer.email || 'No contact details'}</p>
                  {order.customerId && <Link to={`/customers/${order.customerId}`} className="mt-1 inline-block text-[11px] font-semibold text-primary hover:underline">Open guest profile</Link>}
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-line pt-4 text-xs">
                <div className="flex justify-between gap-3"><span className="text-muted">Served by</span><span className="font-semibold text-ink">{order.staffName}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">Created</span><span className="font-semibold text-ink">{formatDate(order.createdAt)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">Last update</span><span className="font-semibold text-ink">{formatDateTime(order.updatedAt)}</span></div>
              </div>
            </SectionCard>

            <SectionCard title="Payment" description="Track how the guest paid and whether it settled.">
              <Field label="Payment method"><Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{['Cash', 'Card', 'M-Pesa', 'Airtel Money', 'Bank Transfer'].map((method) => <option key={method} value={method}>{method}</option>)}</Select></Field>
              <Field label="Payment status" className="mt-3"><Select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>{['PENDING', 'PAID', 'REFUNDED', 'FAILED'].map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</Select></Field>
              <Button size="sm" className="mt-3 w-full" loading={busy === 'payment'} onClick={savePayment} icon={<CreditCard size={14} />}>Save payment</Button>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#fbf8f3] px-3 py-2.5 text-xs text-muted"><CheckCircle2 size={14} className="text-success" /> Current: <StatusBadge status={order.paymentStatus} /></div>
            </SectionCard>
          </div>

          <SectionCard title="Notes" description="Kitchen, allergy or delivery instructions.">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="No notes on this order." />
            <div className="mt-3 flex justify-end"><Button size="sm" variant="secondary" loading={busy === 'notes'} onClick={saveNotes}>Save notes</Button></div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Current status</p><div className="mt-2"><StatusBadge status={order.status} /></div></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-peach text-primary"><RefreshCw size={20} /></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {order.allowedStatuses.length ? order.allowedStatuses.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={status === 'CANCELLED' ? 'danger' : status === 'COMPLETED' ? 'success' : 'primary'}
                  loading={busy === status}
                  onClick={() => updateStatus(status)}
                  icon={status === 'CANCELLED' ? <XCircle size={13} /> : status === 'COMPLETED' ? <CheckCircle2 size={13} /> : <RefreshCw size={13} />}
                >
                  {status === 'CANCELLED' ? 'Cancel order' : `Move to ${titleCase(status)}`}
                </Button>
              )) : <p className="text-xs leading-5 text-muted">This order is in a final state. No further status changes are allowed.</p>}
            </div>
            {order.status === 'COMPLETED' && <p className="mt-4 rounded-xl bg-soft-green px-3 py-2.5 text-[11px] leading-5 text-success">Completed orders consume recipe ingredients and write stock movements automatically.</p>}
          </div>

          <SectionCard title="Status timeline" description="Every transition is recorded with the staff member.">
            <div className="space-y-0">
              {order.history.map((entry, index) => (
                <div key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < order.history.length - 1 && <span className="absolute left-[9px] top-5 h-full w-px bg-line" />}
                  <span className="relative mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-primary/20"><span className="h-2 w-2 rounded-full bg-primary" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><StatusBadge status={entry.status} /><span className="text-[10px] text-muted">{formatDateTime(entry.createdAt)}</span></div>
                    <p className="mt-1 text-xs leading-5 text-[#5f5a53]">{entry.note || 'Status updated.'}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted"><UserRound size={10} /> {entry.staffName || 'System'}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-xs text-muted"><CalendarDays size={14} className="text-primary" /> Order updates are timestamped and visible in the audit log.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

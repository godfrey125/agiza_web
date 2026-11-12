import { useCallback, useEffect, useState } from 'react'
import {
  BadgePercent, CalendarDays, CheckCircle2, Clock, Gift, Mail, Megaphone, Pencil, Plus,
  Send, Tag, Ticket, Trash2, TrendingUp, Users, XCircle,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Campaign, Category, Coupon, Promotion } from '../lib/types'
import { currency, formatDate, number, percent, toInputDate } from '../lib/format'
import {
  Badge, Button, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, PageHeader,
  SectionCard, Select, StatusBadge, Tabs, useConfirm, useToast,
} from '../components/ui'

interface MarketingResponse {
  promotions: Promotion[]
  coupons: Coupon[]
  campaigns: Campaign[]
  summary: {
    activePromotions: number
    totalPromotions: number
    activeCoupons: number
    couponRedemptions: number
    campaigns: number
    audience: { all: number; vip: number; inactive: number }
    customersReached: number | null
    deliveryConnected: boolean
    deliveryNote: string
  }
}

type Tab = 'promotions' | 'coupons' | 'campaigns'

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return toInputDate(date)
}

const emptyPromotion = {
  name: '', type: 'PERCENTAGE', value: '10', scope: 'ALL_ORDERS', scopeId: '',
  minOrder: '0', startDate: toInputDate(new Date()), endDate: addDays(30), active: true,
}
const emptyCoupon = {
  name: '', code: '', discountType: 'PERCENTAGE', value: '10', expiryDate: addDays(60),
  usageLimit: '100', minPurchase: '0', active: true,
}
const emptyCampaign = {
  name: '', audience: 'All customers', type: 'EMAIL', startDate: toInputDate(new Date()),
  endDate: addDays(14), status: 'DRAFT',
}

export default function MarketingPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('marketing.manage')
  const [tab, setTab] = useState<Tab>('promotions')
  const [data, setData] = useState<MarketingResponse | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [promotionModal, setPromotionModal] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [promotionForm, setPromotionForm] = useState({ ...emptyPromotion })
  const [promotionError, setPromotionError] = useState('')
  const [savingPromotion, setSavingPromotion] = useState(false)

  const [couponModal, setCouponModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [couponForm, setCouponForm] = useState({ ...emptyCoupon })
  const [couponError, setCouponError] = useState('')
  const [savingCoupon, setSavingCoupon] = useState(false)

  const [campaignModal, setCampaignModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [campaignForm, setCampaignForm] = useState({ ...emptyCampaign })
  const [campaignError, setCampaignError] = useState('')
  const [savingCampaign, setSavingCampaign] = useState(false)

  const toast = useToast()
  const confirm = useConfirm()

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const result = await api.get<MarketingResponse>('/api/marketing')
      setData(result)
      try {
        const categoryData = await api.get<{ items: Category[] }>('/api/categories')
        setCategories(categoryData.items)
      } catch { setCategories([]) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load marketing.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openPromotionCreate = () => {
    setEditingPromotion(null)
    setPromotionForm({ ...emptyPromotion })
    setPromotionError('')
    setPromotionModal(true)
  }
  const openPromotionEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion)
    setPromotionForm({
      name: promotion.name, type: promotion.type, value: String(promotion.value), scope: promotion.scope,
      scopeId: promotion.scopeId ? String(promotion.scopeId) : '', minOrder: String(promotion.minOrder),
      startDate: String(promotion.startDate).slice(0, 10), endDate: String(promotion.endDate).slice(0, 10),
      active: promotion.active,
    })
    setPromotionError('')
    setPromotionModal(true)
  }
  const savePromotion = async (event: React.FormEvent) => {
    event.preventDefault()
    setPromotionError('')
    if (!promotionForm.name.trim()) return setPromotionError('Promotion name is required.')
    if (promotionForm.endDate < promotionForm.startDate) return setPromotionError('The end date must be after the start date.')
    setSavingPromotion(true)
    try {
      const payload = {
        ...promotionForm,
        value: Number(promotionForm.value),
        minOrder: Number(promotionForm.minOrder) || 0,
        scopeId: promotionForm.scope === 'ALL_ORDERS' || !promotionForm.scopeId ? null : Number(promotionForm.scopeId),
      }
      if (editingPromotion) await api.put(`/api/promotions/${editingPromotion.id}`, payload)
      else await api.post('/api/promotions', payload)
      toast(editingPromotion ? 'Promotion updated.' : 'Promotion created.', 'success')
      setPromotionModal(false)
      load(false)
    } catch (err) {
      setPromotionError(err instanceof Error ? err.message : 'Could not save the promotion.')
    } finally {
      setSavingPromotion(false)
    }
  }
  const togglePromotion = async (promotion: Promotion) => {
    try {
      await api.put(`/api/promotions/${promotion.id}`, { active: !promotion.active })
      toast(`Promotion ${promotion.active ? 'paused' : 'activated'}.`, 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update the promotion.', 'error')
    }
  }
  const removePromotion = async (promotion: Promotion) => {
    const ok = await confirm({ title: 'Delete promotion?', message: `“${promotion.name}” will be permanently removed.`, confirmLabel: 'Delete promotion', tone: 'danger' })
    if (!ok) return
    try {
      await api.delete(`/api/promotions/${promotion.id}`)
      toast('Promotion deleted.', 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete the promotion.', 'error')
    }
  }

  const openCouponCreate = () => {
    setEditingCoupon(null)
    setCouponForm({ ...emptyCoupon })
    setCouponError('')
    setCouponModal(true)
  }
  const openCouponEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon)
    setCouponForm({
      name: coupon.name, code: coupon.code, discountType: coupon.discountType, value: String(coupon.value),
      expiryDate: String(coupon.expiryDate).slice(0, 10), usageLimit: String(coupon.usageLimit),
      minPurchase: String(coupon.minPurchase), active: coupon.active,
    })
    setCouponError('')
    setCouponModal(true)
  }
  const saveCoupon = async (event: React.FormEvent) => {
    event.preventDefault()
    setCouponError('')
    if (!couponForm.name.trim()) return setCouponError('Coupon name is required.')
    if (!/^[A-Za-z0-9_-]{4,24}$/.test(couponForm.code.trim())) return setCouponError('Use a 4–24 character code with letters, numbers, - or _.')
    setSavingCoupon(true)
    try {
      const payload = {
        ...couponForm,
        value: Number(couponForm.value),
        usageLimit: Number(couponForm.usageLimit) || 1,
        minPurchase: Number(couponForm.minPurchase) || 0,
      }
      if (editingCoupon) await api.put(`/api/coupons/${editingCoupon.id}`, payload)
      else await api.post('/api/coupons', payload)
      toast(editingCoupon ? 'Coupon updated.' : 'Coupon created.', 'success')
      setCouponModal(false)
      load(false)
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : 'Could not save the coupon.')
    } finally {
      setSavingCoupon(false)
    }
  }
  const toggleCoupon = async (coupon: Coupon) => {
    try {
      await api.put(`/api/coupons/${coupon.id}`, { active: !coupon.active })
      toast(`Coupon ${coupon.active ? 'paused' : 'activated'}.`, 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update the coupon.', 'error')
    }
  }
  const removeCoupon = async (coupon: Coupon) => {
    const ok = await confirm({ title: 'Delete coupon?', message: `Coupon ${coupon.code} will be permanently removed.`, confirmLabel: 'Delete coupon', tone: 'danger' })
    if (!ok) return
    try {
      await api.delete(`/api/coupons/${coupon.id}`)
      toast('Coupon deleted.', 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete the coupon.', 'error')
    }
  }

  const openCampaignCreate = () => {
    setEditingCampaign(null)
    setCampaignForm({ ...emptyCampaign })
    setCampaignError('')
    setCampaignModal(true)
  }
  const openCampaignEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setCampaignForm({
      name: campaign.name, audience: campaign.audience, type: campaign.type,
      startDate: String(campaign.startDate).slice(0, 10), endDate: String(campaign.endDate).slice(0, 10),
      status: campaign.status,
    })
    setCampaignError('')
    setCampaignModal(true)
  }
  const saveCampaign = async (event: React.FormEvent) => {
    event.preventDefault()
    setCampaignError('')
    if (!campaignForm.name.trim()) return setCampaignError('Campaign name is required.')
    if (campaignForm.endDate < campaignForm.startDate) return setCampaignError('The end date must be after the start date.')
    setSavingCampaign(true)
    try {
      if (editingCampaign) await api.put(`/api/campaigns/${editingCampaign.id}`, campaignForm)
      else await api.post('/api/campaigns', campaignForm)
      toast(editingCampaign ? 'Campaign updated.' : 'Campaign created. Connect a delivery provider before sending.', 'success')
      setCampaignModal(false)
      load(false)
    } catch (err) {
      setCampaignError(err instanceof Error ? err.message : 'Could not save the campaign.')
    } finally {
      setSavingCampaign(false)
    }
  }
  const removeCampaign = async (campaign: Campaign) => {
    const ok = await confirm({ title: 'Delete campaign?', message: `“${campaign.name}” and its recorded performance will be removed.`, confirmLabel: 'Delete campaign', tone: 'danger' })
    if (!ok) return
    try {
      await api.delete(`/api/campaigns/${campaign.id}`)
      toast('Campaign deleted.', 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete the campaign.', 'error')
    }
  }

  const createForTab = () => {
    if (tab === 'promotions') openPromotionCreate()
    else if (tab === 'coupons') openCouponCreate()
    else openCampaignCreate()
  }

  const tabs = [
    { id: 'promotions', label: 'Promotions', count: data?.promotions.length },
    { id: 'coupons', label: 'Coupons', count: data?.coupons.length },
    { id: 'campaigns', label: 'Campaigns', count: data?.campaigns.length },
  ]

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Marketing' }]}
        eyebrow="Growth desk"
        title="Marketing"
        description="Plan discounts, control coupon codes and organise campaigns using the same customer data that powers the rest of the restaurant."
        actions={canManage ? <Button icon={<Plus size={15} />} onClick={createForTab}>New {tab === 'promotions' ? 'promotion' : tab === 'coupons' ? 'coupon' : 'campaign'}</Button> : undefined}
      />

      {loading ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-[110px] rounded-2xl" />)}</div>
          <div className="card p-5"><LoadingBlock rows={8} /></div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : !data ? (
        <ErrorState message="No marketing data was returned." onRetry={() => load()} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ['Active promotions', data.summary.activePromotions, <BadgePercent size={16} />, 'text-primary'],
              ['Active coupons', data.summary.activeCoupons, <Ticket size={16} />, 'text-success'],
              ['Coupon redemptions', data.summary.couponRedemptions, <Gift size={16} />, 'text-[#9A7214]'],
              ['Campaigns', data.summary.campaigns, <Megaphone size={16} />, 'text-[#3569B4]'],
            ].map(([label, value, icon, tone]) => (
              <div key={String(label)} className="card flex items-center gap-3 p-4">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbf8f3] ${tone}`}>{icon as React.ReactNode}</span>
                <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label as string}</p><p className="mt-0.5 font-display text-lg font-extrabold text-ink">{number(Number(value))}</p></div>
              </div>
            ))}
          </div>

          <div className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${data.summary.deliveryConnected ? 'border-[#d6eddd] bg-[#f5fbf7]' : 'border-[#f2e3d8] bg-[linear-gradient(100deg,#FFF6EF,#FFFDF9)]'}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${data.summary.deliveryConnected ? 'bg-soft-green text-success' : 'bg-peach text-primary'}`}>
              {data.summary.deliveryConnected ? <CheckCircle2 size={17} /> : <Mail size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-ink">{data.summary.deliveryConnected ? 'Delivery provider connected' : 'Delivery provider not connected'}</p>
              <p className="mt-0.5 text-[11px] leading-5 text-muted">{data.summary.deliveryConnected ? 'Campaign audience and engagement figures can be recorded from your connected provider.' : data.summary.deliveryNote} Reach, clicks and conversions stay blank until a provider is configured on the server.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="badge-gray">All · {number(data.summary.audience.all)}</Badge>
              <Badge className="badge-yellow">VIP · {number(data.summary.audience.vip)}</Badge>
              <Badge className="badge-blue">Inactive · {number(data.summary.audience.inactive)}</Badge>
            </div>
          </div>

          <Tabs tabs={tabs} active={tab} onChange={(value) => setTab(value as Tab)} />

          {tab === 'promotions' && (
            data.promotions.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Promotion</th><th>Discount</th><th>Scope</th><th>Active period</th><th>Min. order</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
                  <tbody>
                    {data.promotions.map((promotion) => {
                      const expired = String(promotion.endDate).slice(0, 10) < toInputDate(new Date())
                      return (
                        <tr key={promotion.id}>
                          <td><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-peach text-primary"><BadgePercent size={14} /></span><div><p className="table-primary">{promotion.name}</p><p className="table-secondary">{promotion.type === 'PERCENTAGE' ? 'Percentage discount' : 'Fixed amount discount'}</p></div></div></td>
                          <td className="font-semibold text-primary">{promotion.type === 'PERCENTAGE' ? percent(promotion.value, 0) : currency(promotion.value)}</td>
                          <td className="text-xs text-muted">{promotion.scope === 'ALL_ORDERS' ? 'All orders' : promotion.scope === 'CATEGORY' ? `Category · ${categories.find((category) => category.id === promotion.scopeId)?.name || promotion.scopeId}` : `Menu item · ${promotion.scopeId}`}</td>
                          <td className="text-xs text-muted">{formatDate(promotion.startDate)} – {formatDate(promotion.endDate)}</td>
                          <td className="text-xs text-muted">{promotion.minOrder ? currency(promotion.minOrder) : 'None'}</td>
                          <td><StatusBadge status={expired && promotion.active ? 'EXPIRED' : promotion.active ? 'ACTIVE' : 'PAUSED'} /></td>
                          <td>
                            <div className="flex justify-end gap-1.5">
                              {canManage && <button type="button" onClick={() => togglePromotion(promotion)} className={`icon-btn h-8 w-8 ${promotion.active ? 'text-success' : 'text-muted'}`} aria-label="Toggle promotion" title={promotion.active ? 'Pause' : 'Activate'}>{promotion.active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}</button>}
                              {canManage && <button type="button" onClick={() => openPromotionEdit(promotion)} className="icon-btn h-8 w-8" aria-label="Edit promotion"><Pencil size={14} /></button>}
                              {canManage && <button type="button" onClick={() => removePromotion(promotion)} className="icon-btn h-8 w-8 hover:text-coral" aria-label="Delete promotion"><Trash2 size={14} /></button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={<BadgePercent size={24} />} title="No promotions yet" message="Create a promotion to apply a discount to orders during a set period." action={canManage ? <Button icon={<Plus size={15} />} onClick={openPromotionCreate}>Create promotion</Button> : undefined} />
          )}

          {tab === 'coupons' && (
            data.coupons.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Coupon</th><th>Discount</th><th>Min. purchase</th><th>Redemptions</th><th>Expires</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
                  <tbody>
                    {data.coupons.map((coupon) => {
                      const expired = String(coupon.expiryDate).slice(0, 10) < toInputDate(new Date())
                      const exhausted = coupon.usedCount >= coupon.usageLimit
                      return (
                        <tr key={coupon.id}>
                          <td><p className="table-primary">{coupon.name}</p><p className="table-secondary"><span className="rounded bg-[#fbf3ec] px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{coupon.code}</span></p></td>
                          <td className="font-semibold text-primary">{coupon.discountType === 'PERCENTAGE' ? percent(coupon.value, 0) : currency(coupon.value)}</td>
                          <td className="text-xs text-muted">{coupon.minPurchase ? currency(coupon.minPurchase) : 'None'}</td>
                          <td>
                            <div className="flex items-center gap-2"><span className="text-xs font-semibold text-ink">{coupon.usedCount}/{coupon.usageLimit}</span></div>
                            <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-[#f3eee7]"><div className="h-full rounded-full bg-warning" style={{ width: `${Math.min(100, (coupon.usedCount / Math.max(1, coupon.usageLimit)) * 100)}%` }} /></div>
                          </td>
                          <td className="text-xs text-muted">{formatDate(coupon.expiryDate)}</td>
                          <td><StatusBadge status={expired ? 'EXPIRED' : exhausted ? 'USED UP' : coupon.active ? 'ACTIVE' : 'PAUSED'} /></td>
                          <td>
                            <div className="flex justify-end gap-1.5">
                              {canManage && <button type="button" onClick={() => toggleCoupon(coupon)} className={`icon-btn h-8 w-8 ${coupon.active ? 'text-success' : 'text-muted'}`} aria-label="Toggle coupon" title={coupon.active ? 'Pause' : 'Activate'}>{coupon.active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}</button>}
                              {canManage && <button type="button" onClick={() => openCouponEdit(coupon)} className="icon-btn h-8 w-8" aria-label="Edit coupon"><Pencil size={14} /></button>}
                              {canManage && <button type="button" onClick={() => removeCoupon(coupon)} className="icon-btn h-8 w-8 hover:text-coral" aria-label="Delete coupon"><Trash2 size={14} /></button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={<Ticket size={24} />} title="No coupons yet" message="Create a coupon code guests can enter at checkout." action={canManage ? <Button icon={<Plus size={15} />} onClick={openCouponCreate}>Create coupon</Button> : undefined} />
          )}

          {tab === 'campaigns' && (
            data.campaigns.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {data.campaigns.map((campaign) => (
                  <div key={campaign.id} className="card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-peach text-primary"><Send size={17} /></span>
                        <div className="min-w-0">
                          <p className="font-display text-base font-bold text-ink">{campaign.name}</p>
                          <p className="mt-0.5 text-xs text-muted">{campaign.type} · {campaign.audience}</p>
                        </div>
                      </div>
                      <StatusBadge status={campaign.status} />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted"><CalendarDays size={12} /> {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}</div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        ['Reached', campaign.reached],
                        ['Clicks', campaign.clicks],
                        ['Conversions', campaign.conversions],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl bg-[#fbf8f3] p-3 text-center">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-muted">{label as string}</p>
                          <p className="mt-1 font-display text-base font-extrabold text-ink">{data.summary.deliveryConnected ? number(Number(value)) : '—'}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                      <p className="text-[10px] leading-4 text-muted">{data.summary.deliveryConnected ? 'Recorded by the connected delivery provider.' : 'No delivery provider connected — engagement is not measured.'}</p>
                      {canManage && <div className="flex gap-1.5">
                        <button type="button" onClick={() => openCampaignEdit(campaign)} className="icon-btn h-8 w-8" aria-label="Edit campaign"><Pencil size={14} /></button>
                        <button type="button" onClick={() => removeCampaign(campaign)} className="icon-btn h-8 w-8 hover:text-coral" aria-label="Delete campaign"><Trash2 size={14} /></button>
                      </div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={<Megaphone size={24} />} title="No campaigns yet" message="Draft a campaign and prepare the audience. Sending requires a connected email or SMS provider." action={canManage ? <Button icon={<Plus size={15} />} onClick={openCampaignCreate}>Create campaign</Button> : undefined} />
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <SectionCard title="Coupon codes validate server-side" description="Limits, expiry and minimum purchase are checked before an order total is changed." className="md:col-span-1">
              <div className="flex items-center gap-3 rounded-xl bg-[#fbf8f3] p-3"><Tag size={17} className="text-primary" /><p className="text-[11px] leading-5 text-muted">Attempting to exceed a coupon’s usage limit returns a clear error at checkout.</p></div>
            </SectionCard>
            <SectionCard title="Audiences use live customer tiers" description="VIP and inactive counts come from real order history."><div className="flex items-center gap-3 rounded-xl bg-[#fbf8f3] p-3"><Users size={17} className="text-success" /><p className="text-[11px] leading-5 text-muted">{number(data.summary.audience.vip)} VIP guests and {number(data.summary.audience.inactive)} guests inactive for 45+ days.</p></div></SectionCard>
            <SectionCard title="Performance only when measured" description="We do not invent reach or conversion figures."><div className="flex items-center gap-3 rounded-xl bg-[#fbf8f3] p-3"><TrendingUp size={17} className="text-[#9A7214]" /><p className="text-[11px] leading-5 text-muted">{data.summary.deliveryConnected ? `${number(data.summary.customersReached || 0)} customers reached.` : 'Connect a provider to unlock engagement reporting.'}</p></div></SectionCard>
          </div>
        </div>
      )}

      <Modal open={promotionModal} onClose={() => setPromotionModal(false)} title={editingPromotion ? 'Edit promotion' : 'New promotion'} description="Apply a percentage or fixed discount to qualifying orders." width="max-w-2xl"
        footer={<><Button variant="secondary" onClick={() => setPromotionModal(false)}>Cancel</Button><Button onClick={savePromotion} loading={savingPromotion} icon={<BadgePercent size={15} />}>{editingPromotion ? 'Save changes' : 'Create promotion'}</Button></>}>
        <form onSubmit={savePromotion} className="space-y-4">
          {promotionError && <div className="rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{promotionError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Promotion name" required className="sm:col-span-2"><Input value={promotionForm.name} onChange={(event) => setPromotionForm({ ...promotionForm, name: event.target.value })} placeholder="e.g. Weekend feast 15% off" /></Field>
            <Field label="Discount type"><Select value={promotionForm.type} onChange={(event) => setPromotionForm({ ...promotionForm, type: event.target.value })}><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></Select></Field>
            <Field label={promotionForm.type === 'PERCENTAGE' ? 'Discount %' : 'Discount amount'} required><Input type="number" min="0.01" max={promotionForm.type === 'PERCENTAGE' ? '100' : undefined} step="0.01" value={promotionForm.value} onChange={(event) => setPromotionForm({ ...promotionForm, value: event.target.value })} /></Field>
            <Field label="Applies to"><Select value={promotionForm.scope} onChange={(event) => setPromotionForm({ ...promotionForm, scope: event.target.value, scopeId: '' })}><option value="ALL_ORDERS">All orders</option><option value="CATEGORY">A category</option></Select></Field>
            <Field label="Category">{promotionForm.scope === 'CATEGORY' ? <Select value={promotionForm.scopeId} onChange={(event) => setPromotionForm({ ...promotionForm, scopeId: event.target.value })}><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select> : <div className="input flex items-center bg-[#f8f5f0] text-xs text-muted">Every menu category</div>}</Field>
            <Field label="Minimum order"><Input type="number" min="0" step="0.01" value={promotionForm.minOrder} onChange={(event) => setPromotionForm({ ...promotionForm, minOrder: event.target.value })} /></Field>
            <Field label="Start date" required><Input type="date" value={promotionForm.startDate} onChange={(event) => setPromotionForm({ ...promotionForm, startDate: event.target.value })} /></Field>
            <Field label="End date" required><Input type="date" value={promotionForm.endDate} onChange={(event) => setPromotionForm({ ...promotionForm, endDate: event.target.value })} /></Field>
            <label className="flex items-center gap-2 text-xs font-medium text-[#5f5a53]"><input type="checkbox" checked={promotionForm.active} onChange={(event) => setPromotionForm({ ...promotionForm, active: event.target.checked })} className="h-4 w-4 accent-[#F05A32]" /> Promotion is active</label>
          </div>
        </form>
      </Modal>

      <Modal open={couponModal} onClose={() => setCouponModal(false)} title={editingCoupon ? 'Edit coupon' : 'New coupon'} description="A code guests can enter at checkout, with a usage cap and expiry." width="max-w-2xl"
        footer={<><Button variant="secondary" onClick={() => setCouponModal(false)}>Cancel</Button><Button onClick={saveCoupon} loading={savingCoupon} icon={<Ticket size={15} />}>{editingCoupon ? 'Save changes' : 'Create coupon'}</Button></>}>
        <form onSubmit={saveCoupon} className="space-y-4">
          {couponError && <div className="rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{couponError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Coupon name" required><Input value={couponForm.name} onChange={(event) => setCouponForm({ ...couponForm, name: event.target.value })} placeholder="Weekend treat" /></Field>
            <Field label="Code" required hint="4–24 letters, numbers, - or _."><Input value={couponForm.code} onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value.toUpperCase() })} placeholder="WEEKEND20" className="font-mono uppercase" /></Field>
            <Field label="Discount type"><Select value={couponForm.discountType} onChange={(event) => setCouponForm({ ...couponForm, discountType: event.target.value })}><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></Select></Field>
            <Field label="Discount value" required><Input type="number" min="0.01" step="0.01" value={couponForm.value} onChange={(event) => setCouponForm({ ...couponForm, value: event.target.value })} /></Field>
            <Field label="Minimum purchase"><Input type="number" min="0" step="0.01" value={couponForm.minPurchase} onChange={(event) => setCouponForm({ ...couponForm, minPurchase: event.target.value })} /></Field>
            <Field label="Usage limit" required hint="Maximum number of redemptions."><Input type="number" min="1" step="1" value={couponForm.usageLimit} onChange={(event) => setCouponForm({ ...couponForm, usageLimit: event.target.value })} /></Field>
            <Field label="Expiry date" required><Input type="date" value={couponForm.expiryDate} onChange={(event) => setCouponForm({ ...couponForm, expiryDate: event.target.value })} /></Field>
            <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium text-[#5f5a53]"><input type="checkbox" checked={couponForm.active} onChange={(event) => setCouponForm({ ...couponForm, active: event.target.checked })} className="h-4 w-4 accent-[#F05A32]" /> Coupon is active</label>
          </div>
        </form>
      </Modal>

      <Modal open={campaignModal} onClose={() => setCampaignModal(false)} title={editingCampaign ? 'Edit campaign' : 'New campaign'} description="Plan the campaign now. Sending is only available when a real email or SMS provider is connected." width="max-w-2xl"
        footer={<><Button variant="secondary" onClick={() => setCampaignModal(false)}>Cancel</Button><Button onClick={saveCampaign} loading={savingCampaign} icon={<Megaphone size={15} />}>{editingCampaign ? 'Save changes' : 'Create campaign'}</Button></>}>
        <form onSubmit={saveCampaign} className="space-y-4">
          {campaignError && <div className="rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{campaignError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Campaign name" required className="sm:col-span-2"><Input value={campaignForm.name} onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })} placeholder="e.g. Diwali VIP preview" /></Field>
            <Field label="Audience"><Select value={campaignForm.audience} onChange={(event) => setCampaignForm({ ...campaignForm, audience: event.target.value })}><option>All customers</option><option>VIP customers</option><option>Inactive 45+ days</option><option>New customers</option></Select></Field>
            <Field label="Channel"><Select value={campaignForm.type} onChange={(event) => setCampaignForm({ ...campaignForm, type: event.target.value })}><option value="EMAIL">Email</option><option value="SMS">SMS</option></Select></Field>
            <Field label="Start date" required><Input type="date" value={campaignForm.startDate} onChange={(event) => setCampaignForm({ ...campaignForm, startDate: event.target.value })} /></Field>
            <Field label="End date" required><Input type="date" value={campaignForm.endDate} onChange={(event) => setCampaignForm({ ...campaignForm, endDate: event.target.value })} /></Field>
            <Field label="Status"><Select value={campaignForm.status} onChange={(event) => setCampaignForm({ ...campaignForm, status: event.target.value })}><option value="DRAFT">Draft</option><option value="SCHEDULED">Scheduled</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="COMPLETED">Completed</option></Select></Field>
            <div className="rounded-xl bg-[#fbf8f3] p-3 text-[11px] leading-5 text-muted sm:col-span-2"><Clock size={13} className="mr-1 inline text-primary" /> {data?.summary.deliveryConnected ? 'A delivery provider is connected on this server.' : 'No delivery provider is connected. Creating this campaign will not send any email or SMS.'}</div>
          </div>
        </form>
      </Modal>
    </div>
  )
}

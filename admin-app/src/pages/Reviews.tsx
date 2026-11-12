import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageSquare, Pencil, RefreshCw, Star, ThumbsDown, ThumbsUp, Trash2, Users,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Review } from '../lib/types'
import { formatDateTime, number } from '../lib/format'
import {
  Avatar, Button, EmptyState, ErrorState, Field, FoodImage, LoadingBlock, Modal, PageHeader,
  Pagination, RatingStars, SearchInput, SectionCard, Select, Tabs, Textarea, useConfirm, useToast,
} from '../components/ui'
import { RatingDistribution, SimpleBarChart } from '../components/charts'

interface ReviewSummary {
  total: number
  average: number
  five: number
  negative: number
  unanswered: number
}

interface ReviewsResponse {
  items: Review[]
  total: number
  page: number
  pageSize: number
  summary: ReviewSummary
}

interface ReviewAnalytics {
  summary: ReviewSummary
  distribution: { rating: number; count: number }[]
  trend: { month: string; average: number; count: number }[]
  products: { id: number; name: string; reviews: number; average: number }[]
}

export default function ReviewsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('reviews.manage')
  const [data, setData] = useState<ReviewsResponse | null>(null)
  const [analytics, setAnalytics] = useState<ReviewAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [rating, setRating] = useState('all')
  const [responseFilter, setResponseFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [responding, setResponding] = useState<Review | null>(null)
  const [responseText, setResponseText] = useState('')
  const [savingResponse, setSavingResponse] = useState(false)
  const [responseError, setResponseError] = useState('')
  const toast = useToast()
  const confirm = useConfirm()

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: '10', q: query, rating, response: responseFilter,
      })
      const [reviewData, analyticsData] = await Promise.all([
        api.get<ReviewsResponse>(`/api/reviews?${params.toString()}`),
        api.get<ReviewAnalytics>('/api/reviews/analytics'),
      ])
      setData(reviewData)
      setAnalytics(analyticsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reviews.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, query, rating, responseFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 220)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => { setPage(1) }, [query, rating, responseFilter, activeTab])

  const changeTab = (tab: string) => {
    setActiveTab(tab)
    if (tab === 'unanswered') setResponseFilter('unanswered')
    else if (tab === 'answered') setResponseFilter('answered')
    else setResponseFilter('all')
  }

  const openResponse = (review: Review) => {
    setResponding(review)
    setResponseText(review.response || '')
    setResponseError('')
  }

  const saveResponse = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!responding) return
    if (!responseText.trim()) return setResponseError('Write a response before saving.')
    setSavingResponse(true)
    setResponseError('')
    try {
      await api.patch(`/api/reviews/${responding.id}/response`, { response: responseText })
      toast('Response published.', 'success')
      setResponding(null)
      load(false)
    } catch (err) {
      setResponseError(err instanceof Error ? err.message : 'Could not save the response.')
    } finally {
      setSavingResponse(false)
    }
  }

  const remove = async (review: Review) => {
    const ok = await confirm({
      title: 'Delete review?',
      message: `The ${review.rating}-star review from ${review.customerName} will be permanently deleted. This also changes review analytics.`,
      confirmLabel: 'Delete review',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/api/reviews/${review.id}`)
      toast('Review deleted.', 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete the review.', 'error')
    }
  }

  const summary = data?.summary || analytics?.summary
  const trend = analytics?.trend.map((item) => ({ ...item, label: item.month })) || []

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Reviews' }]}
        eyebrow="Guest voice"
        title="Reviews"
        description="Read what guests actually said, spot dishes that need attention and respond in public — all from real customer feedback."
        actions={<Button variant="secondary" icon={<RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />} onClick={() => load(false)} disabled={refreshing}>Refresh</Button>}
      />

      {loading ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-[110px] rounded-2xl" />)}</div>
          <div className="card p-5"><LoadingBlock rows={8} /></div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : !data || !summary ? (
        <ErrorState message="No review data was returned." onRetry={() => load()} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ['Total reviews', number(summary.total), <MessageSquare size={16} />, 'text-primary'],
              ['Average rating', `${summary.average.toFixed(1)} / 5`, <Star size={16} />, 'text-[#9A7214]'],
              ['Five-star reviews', number(summary.five), <ThumbsUp size={16} />, 'text-success'],
              ['Needs attention', number(summary.negative), <ThumbsDown size={16} />, 'text-coral'],
            ].map(([label, value, icon, tone]) => (
              <div key={String(label)} className="card flex items-center gap-3 p-4">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbf8f3] ${tone}`}>{icon as React.ReactNode}</span>
                <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label as string}</p><p className="mt-0.5 font-display text-lg font-extrabold text-ink">{value}</p></div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <SectionCard title="Rating distribution" description="All reviews ever recorded.">
              {analytics ? <RatingDistribution data={analytics.distribution} /> : <LoadingBlock rows={5} />}
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
                <div className="rounded-xl bg-[#fbf8f3] p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-muted">Unanswered</p><p className="mt-1 font-display text-lg font-extrabold text-coral">{number(summary.unanswered)}</p></div>
                <div className="rounded-xl bg-[#fbf8f3] p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-muted">Response rate</p><p className="mt-1 font-display text-lg font-extrabold text-success">{summary.total ? Math.round(((summary.total - summary.unanswered) / summary.total) * 100) : 0}%</p></div>
              </div>
            </SectionCard>

            <SectionCard title="Review volume" description="Monthly review activity.">
              {trend.length ? <SimpleBarChart data={trend} xKey="label" bars={[{ key: 'count', label: 'Reviews', color: '#F05A32' }]} height={262} /> : <div className="flex h-[262px] items-center justify-center text-sm text-muted">No review history yet.</div>}
            </SectionCard>

            <SectionCard title="Dish feedback" description="Most-reviewed menu items." action={<Star size={17} className="text-warning" />}>
              {analytics?.products.length ? (
                <div className="space-y-3">
                  {analytics.products.map((product) => (
                    <Link key={product.id} to={`/menu/${product.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:border-primary/30">
                      <div className="min-w-0"><p className="truncate text-xs font-semibold text-ink">{product.name}</p><p className="mt-0.5 text-[10px] text-muted">{number(product.reviews)} review{product.reviews === 1 ? '' : 's'}</p></div>
                      <div className="text-right"><RatingStars rating={product.average} /><p className="mt-0.5 text-[10px] font-semibold text-ink">{product.average.toFixed(1)}</p></div>
                    </Link>
                  ))}
                </div>
              ) : <div className="py-8 text-center text-sm text-muted">Dish feedback appears after reviews are linked to menu items.</div>}
            </SectionCard>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs
                tabs={[
                  { id: 'all', label: 'All reviews', count: summary.total },
                  { id: 'unanswered', label: 'Unanswered', count: summary.unanswered },
                  { id: 'answered', label: 'Answered' },
                ]}
                active={activeTab}
                onChange={changeTab}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <SearchInput value={query} onChange={setQuery} placeholder="Search reviews or guests…" />
                <Select value={rating} onChange={(event) => setRating(event.target.value)} className="text-xs sm:w-[140px]">
                  <option value="all">All ratings</option>
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}
                </Select>
              </div>
            </div>

            {!data.items.length ? (
              <EmptyState icon={<MessageSquare size={24} />} title="No reviews match this view" message="Try a different rating, response state or search term." />
            ) : (
              <>
                <div className="space-y-3">
                  {data.items.map((review) => (
                    <article key={review.id} className="card p-4 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row">
                        <Avatar src={review.customerImage} name={review.customerName} size={44} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-ink">{review.customerName}</p>
                                <RatingStars rating={review.rating} showValue />
                                {review.response && <span className="badge-green">Answered</span>}
                              </div>
                              <p className="mt-1 text-[10px] text-muted">{formatDateTime(review.createdAt)}{review.orderNumber ? ` · Order ${review.orderNumber}` : ''}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {canManage && <button type="button" onClick={() => openResponse(review)} className="icon-btn h-8 w-8" aria-label="Respond to review" title={review.response ? 'Edit response' : 'Respond'}><Pencil size={14} /></button>}
                              {canManage && <button type="button" onClick={() => remove(review)} className="icon-btn h-8 w-8 hover:text-coral" aria-label="Delete review"><Trash2 size={14} /></button>}
                            </div>
                          </div>

                          {review.title && <h3 className="mt-3 font-display text-base font-bold text-ink">{review.title}</h3>}
                          <p className="mt-1.5 text-sm leading-6 text-[#5f5a53]">{review.message}</p>

                          {review.menuItemName && (
                            <Link to="/menu" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-line bg-[#fcfaf6] px-2.5 py-1.5 text-[11px] font-medium text-[#5f5a53] transition hover:border-primary/30">
                              <FoodImage src={review.menuItemImage} alt={review.menuItemName} className="h-6 w-6" rounded="rounded-md" />
                              {review.menuItemName}
                            </Link>
                          )}

                          {review.response ? (
                            <div className="mt-4 rounded-xl border-l-[3px] border-primary bg-[#fff9f5] p-3.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">Response from the restaurant</p>
                                <p className="text-[10px] text-muted">{formatDateTime(review.responseAt)}</p>
                              </div>
                              <p className="mt-1.5 text-xs leading-5 text-[#5f5a53]">{review.response}</p>
                            </div>
                          ) : (
                            <button type="button" onClick={() => openResponse(review)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline" disabled={!canManage}>
                              <MessageSquare size={13} /> {canManage ? 'Write a public response' : 'Awaiting a response'}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="card overflow-hidden"><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} /></div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-line bg-[#fcfaf6] px-4 py-3 text-[11px] leading-5 text-muted">
            <Users size={14} className="shrink-0 text-primary" />
            Reviews are linked to real guests and orders. Deleting a review or publishing a response updates the analytics above and is recorded in the audit log.
          </div>
        </div>
      )}

      <Modal
        open={Boolean(responding)}
        onClose={() => setResponding(null)}
        title={responding?.response ? 'Edit response' : 'Respond to review'}
        description={responding ? `${responding.customerName} · ${responding.rating}-star review` : undefined}
        width="max-w-xl"
        footer={<><Button variant="secondary" onClick={() => setResponding(null)}>Cancel</Button><Button onClick={saveResponse} loading={savingResponse} icon={<MessageSquare size={14} />}>Publish response</Button></>}
      >
        <form onSubmit={saveResponse} className="space-y-4">
          {responseError && <div className="rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{responseError}</div>}
          {responding && <div className="rounded-xl bg-[#fbf8f3] p-3.5"><RatingStars rating={responding.rating} /><p className="mt-2 text-sm font-semibold text-ink">{responding.title || 'Guest review'}</p><p className="mt-1 text-xs leading-5 text-muted">{responding.message}</p></div>}
          <Field label="Your response" required hint="This will be visible to the guest."><Textarea value={responseText} onChange={(event) => setResponseText(event.target.value)} placeholder="Thank the guest, address their feedback and invite them back…" maxLength={1200} /></Field>
          <p className="text-right text-[10px] text-muted">{responseText.length}/1,200</p>
        </form>
      </Modal>
    </div>
  )
}

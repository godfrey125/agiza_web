import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
} from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, Check, CheckCircle2, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ImagePlus, Info, Loader2, Search, Trash2, UtensilsCrossed,
  X, XCircle,
} from 'lucide-react'
import { api, assetUrl, readFileAsDataUrl } from '../lib/api'
import { cn, initials, initialsColor, number, relativeChange } from '../lib/format'

// ---------------------------------------------------------------------------
// Buttons and fields
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'xs' | 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...props }: ButtonProps) {
  const variantClass = {
    primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost',
    danger: 'btn-danger', success: 'btn-success',
  }[variant]
  const sizeClass = size === 'xs' ? 'btn-xs' : size === 'sm' ? 'btn-sm' : ''
  return (
    <button type="button" className={cn(variantClass, sizeClass, className)} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 size={size === 'md' ? 16 : 13} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}

interface FieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && <label className="label">{label}{required && <span className="ml-1 text-primary">*</span>}</label>}
      {children}
      {error ? <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-coral"><AlertCircle size={12} />{error}</p> : hint ? <p className="help">{hint}</p> : null}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('select', className)} {...props}>{children}</select>
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('textarea', className)} {...props} />
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (value: boolean) => void; label?: string; description?: string; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition', checked ? 'border-primary bg-primary' : 'border-[#ddd4c7] bg-[#eee9e2]')}
      >
        <span className={cn('absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition', checked ? 'left-[21px]' : 'left-0.5')} />
      </button>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-semibold text-ink">{label}</span>}
          {description && <span className="mt-0.5 block text-xs leading-5 text-muted">{description}</span>}
        </span>
      )}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export function Avatar({ src, name, size = 36, className }: { src?: string; name?: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  const resolved = assetUrl(src || '')
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold', initialsColor(name), className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * .32) }}
      aria-label={name}
    >
      {resolved && !failed
        ? <img src={resolved} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        : initials(name)}
    </span>
  )
}

export function FoodImage({ src, alt, className, rounded = 'rounded-xl' }: { src?: string; alt: string; className?: string; rounded?: string }) {
  const [failed, setFailed] = useState(false)
  const resolved = assetUrl(src || '')
  if (!resolved || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-[linear-gradient(135deg,#FFF0E8,#F6E9DC)] text-primary', rounded, className)}>
        <UtensilsCrossed size={22} />
      </div>
    )
  }
  return <img src={resolved} alt={alt} className={cn('object-cover', rounded, className)} onError={() => setFailed(true)} loading="lazy" />
}

// ---------------------------------------------------------------------------
// Headers and cards
// ---------------------------------------------------------------------------

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 && <ChevronRight size={12} className="text-[#b5aca0]" />}
          {item.href && index < items.length - 1
            ? <a href={item.href} className="transition hover:text-primary">{item.label}</a>
            : <span className={index === items.length - 1 ? 'font-medium text-ink' : ''}>{item.label}</span>}
        </span>
      ))}
    </nav>
  )
}

export function PageHeader({
  eyebrow, title, description, breadcrumbs, actions,
}: {
  eyebrow?: string; title: string; description?: string;
  breadcrumbs?: { label: string; href?: string }[]; actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionCard({
  title, description, action, children, className, bodyClassName,
}: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn('card overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

export function StatCard({
  label, value, change, icon, spark, tone = 'orange', hint,
}: { label: string; value: string; change?: number; icon: ReactNode; spark?: number[]; tone?: 'orange' | 'green' | 'yellow' | 'blue'; hint?: string }) {
  const toneMap = {
    orange: 'bg-peach text-primary', green: 'bg-soft-green text-success',
    yellow: 'bg-soft-yellow text-[#9A7214]', blue: 'bg-[#EEF4FF] text-[#3569B4]',
  }
  return (
    <div className="card card-interactive relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
          <p className="mt-2 font-display text-[28px] font-extrabold tracking-[-0.04em] text-ink">{value}</p>
        </div>
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', toneMap[tone])}>{icon}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          {change !== undefined && (
            <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', change >= 0 ? 'text-success' : 'text-coral')}>
              {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {relativeChange(change)}
              <span className="ml-1 font-normal text-muted">vs previous period</span>
            </span>
          )}
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
        {spark && spark.length > 1 && <Sparkline values={spark} positive={change === undefined || change >= 0} />}
      </div>
    </div>
  )
}

export function Sparkline({ values, positive = true, width = 96, height = 38 }: { values: number[]; positive?: boolean; width?: number; height?: number }) {
  const id = useId().replace(/:/g, '')
  if (!values.length) return <div className="h-10 w-24" />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width : (index / (values.length - 1)) * width
    const y = height - 4 - ((value - min) / range) * (height - 8)
    return `${x},${y}`
  }).join(' ')
  const color = positive ? '#43A66A' : '#E94B35'
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-24 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#spark-${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Badges, ratings and tabs
// ---------------------------------------------------------------------------

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('badge', className)}>{children}</span>
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = (() => {
    const value = String(status || '').toUpperCase()
    if (['COMPLETED', 'PAID', 'ACTIVE', 'OK', 'CONFIRMED', 'VIP', 'REGULAR', 'ANSWERED'].includes(value)) return 'badge-green'
    if (['PENDING', 'PREPARING', 'LOW', 'SCHEDULED', 'RETURNING', 'NEW', 'DRAFT', 'PAUSED'].includes(value)) return 'badge-yellow'
    if (['CANCELLED', 'FAILED', 'OUT', 'INACTIVE', 'TERMINATED', 'NEGATIVE'].includes(value)) return 'badge-red'
    if (['READY', 'SUSPENDED', 'OVER', 'REFUNDED'].includes(value)) return 'badge-blue'
    return 'badge-gray'
  })()
  const text = String(status || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  return <span className={cn(tone, className)}>{text || '—'}</span>
}

export function RatingStars({ rating, size = 14, showValue = false }: { rating: number; size?: number; showValue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width={size} height={size} viewBox="0 0 24 24" fill={star <= Math.round(rating) ? '#EAB544' : '#EEE9E2'} aria-hidden="true">
          <path d="m12 2.6 2.8 5.7 6.3.9-4.6 4.5 1.1 6.2-5.6-3-5.6 3 1.1-6.2L2.9 9.2l6.3-.9L12 2.6Z" />
        </svg>
      ))}
      {showValue && <span className="ml-1 text-xs font-semibold text-ink">{rating.toFixed(1)}</span>}
    </span>
  )
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="hide-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 shadow-soft">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
            active === tab.id ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-[#fbf7f1] hover:text-ink',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', active === tab.id ? 'bg-white/20' : 'bg-[#f3eee7] text-muted')}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading, empty and pagination
// ---------------------------------------------------------------------------

export function LoadingBlock({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton h-12 w-full" style={{ opacity: 1 - index * .1 }} />
      ))}
    </div>
  )
}

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => <div key={index} className="skeleton h-[134px] rounded-2xl" />)}
    </div>
  )
}

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e4dccf] bg-[#fdfbf7] px-5 py-12 text-center">
      <div className="empty-illustration">{icon || <Search size={24} />}</div>
      <h3 className="mt-4 font-display text-base font-bold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[#f4d7d2] bg-soft-red px-5 py-10 text-center">
      <AlertCircle size={26} className="text-coral" />
      <h3 className="mt-3 font-display text-base font-bold text-ink">We could not load this view</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = total ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(total, page * pageSize)
  const pageNumbers = useMemo(() => {
    const values: number[] = []
    const from = Math.max(1, Math.min(page - 1, pages - 2))
    const to = Math.min(pages, from + 2)
    for (let value = from; value <= to; value += 1) values.push(value)
    return values
  }, [page, pages])
  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted">Showing <span className="font-semibold text-ink">{start}–{end}</span> of <span className="font-semibold text-ink">{number(total)}</span></p>
      <div className="flex items-center gap-1">
        <button type="button" className="icon-btn h-8 w-8" disabled={page <= 1} onClick={() => onChange(1)}><ChevronsLeft size={14} /></button>
        <button type="button" className="icon-btn h-8 w-8" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={14} /></button>
        {pageNumbers.map((value) => (
          <button key={value} type="button" onClick={() => onChange(value)} className={cn('h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition', value === page ? 'bg-primary text-white' : 'text-muted hover:bg-[#faf6ef] hover:text-ink')}>{value}</button>
        ))}
        <button type="button" className="icon-btn h-8 w-8" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={14} /></button>
        <button type="button" className="icon-btn h-8 w-8" disabled={page >= pages} onClick={() => onChange(pages)}><ChevronsRight size={14} /></button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search and selectable inputs
// ---------------------------------------------------------------------------

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative w-full sm:w-64', className)}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a29a90]" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="input pl-9" />
    </div>
  )
}

export function DateRangeFields({ start, end, onStart, onEnd }: { start: string; end: string; onStart: (value: string) => void; onEnd: (value: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" value={start} onChange={(event) => onStart(event.target.value)} className="input w-auto text-xs" aria-label="Start date" />
      <span className="text-xs text-muted">to</span>
      <input type="date" value={end} onChange={(event) => onEnd(event.target.value)} className="input w-auto text-xs" aria-label="End date" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal, confirm and toasts
// ---------------------------------------------------------------------------

export function Modal({
  open, onClose, title, description, children, footer, width = 'max-w-xl',
}: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', handler) }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className={cn('modal-panel', width)} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="icon-btn shrink-0" aria-label="Close dialog"><X size={16} /></button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>
const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((nextOptions) => {
    setOptions(nextOptions)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const finish = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={Boolean(options)} onClose={() => finish(false)} title={options?.title || 'Confirm action'} width="max-w-md"
        footer={(
          <>
            <Button variant="secondary" onClick={() => finish(false)}>{options?.cancelLabel || 'Cancel'}</Button>
            <Button variant={options?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => finish(true)}>{options?.confirmLabel || 'Confirm'}</Button>
          </>
        )}
      >
        <p className="text-sm leading-6 text-muted">{options?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) throw new Error('useConfirm must be used inside ConfirmProvider.')
  return context
}

type ToastTone = 'success' | 'error' | 'warning' | 'info'
interface ToastItem { id: number; message: string; tone: ToastTone; title?: string }
interface ToastContextValue { push: (message: string, tone?: ToastTone, title?: string) => void }
const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const push = useCallback((message: string, tone: ToastTone = 'success', title?: string) => {
    counter.current += 1
    const id = counter.current
    setToasts((current) => [...current, { id, message, tone, title }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500)
  }, [])

  const value = useMemo(() => ({ push }), [push])
  const icons: Record<ToastTone, ReactNode> = {
    success: <CheckCircle2 size={18} />, error: <XCircle size={18} />,
    warning: <AlertCircle size={18} />, info: <Info size={18} />,
  }
  const tones: Record<ToastTone, string> = {
    success: 'border-[#d6eddd] text-success', error: 'border-[#f4d7d2] text-coral',
    warning: 'border-[#f4e6b8] text-[#9a7214]', info: 'border-[#d8e5f8] text-[#3569B4]',
  }
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:right-5 sm:top-5 sm:w-[360px]">
        {toasts.map((toast) => (
          <div key={toast.id} className={cn('toast-item pointer-events-auto', tones[toast.tone])}>
            <span className="mt-0.5 shrink-0">{icons[toast.tone]}</span>
            <div className="min-w-0 flex-1">
              {toast.title && <p className="text-sm font-bold text-ink">{toast.title}</p>}
              <p className="text-sm leading-5 text-[#5f5a53]">{toast.message}</p>
            </div>
            <button type="button" className="text-[#a29a90] hover:text-ink" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider.')
  return context.push
}

// ---------------------------------------------------------------------------
// Image uploader
// ---------------------------------------------------------------------------

export function ImageUploader({ value, onChange, label = 'Image', hint = 'PNG, JPG or WEBP up to 5 MB.' }: { value: string; onChange: (url: string) => void; label?: string; hint?: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const toast = useToast()

  const chooseFile = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast('Select an image file.', 'error')
    if (file.size > 5 * 1024 * 1024) return toast('Images must be smaller than 5 MB.', 'error')
    setUploading(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const result = await api.upload(dataUrl)
      onChange(result.url)
      toast('Image uploaded.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Image upload failed.', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-line">
            <img src={assetUrl(value)} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange('')} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/65 text-white" aria-label="Remove image"><Trash2 size={11} /></button>
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-[#ddd4c7] bg-[#fdfbf7] text-muted transition hover:border-primary hover:text-primary" aria-label="Upload image">
            {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
          </button>
        )}
        <div>
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={uploading} icon={<ImagePlus size={14} />}>Choose image</Button>
          <p className="help mt-1">{hint}</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = '' }} />
    </div>
  )
}

export function CheckIcon() {
  return <Check size={14} />
}

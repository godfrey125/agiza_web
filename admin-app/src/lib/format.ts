export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function currency(value: number | string | null | undefined, decimals = 0) {
  const number = Number(value) || 0
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency', currency: 'TZS',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(number)
}

export function compactNumber(value: number | string | null | undefined) {
  const number = Number(value) || 0
  if (Math.abs(number) >= 1000000000) return `${(number / 1000000000).toFixed(1)}B`
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1)}M`
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(number >= 100000 ? 0 : 1)}k`
  return String(number)
}

export function number(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-GB').format(Number(value) || 0)
}

export function percent(value: number | string | null | undefined, decimals = 1) {
  return `${(Number(value) || 0).toFixed(decimals)}%`
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date)
}

export function formatTime(value?: string | Date | null) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit' }).format(date)
}

export function timeAgo(value?: string | Date | null) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 45) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return formatDate(date)
}

export function titleCase(value: string) {
  return String(value || '').toLowerCase().replace(/(^|\s|_)([a-z])/g, (_match, prefix, letter) => `${prefix === '_' ? ' ' : prefix}${letter.toUpperCase()}`)
}

export function initials(name?: string) {
  return String(name || 'FA')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'FA'
}

export function statusTone(status?: string) {
  const value = String(status || '').toUpperCase()
  if (['COMPLETED', 'PAID', 'ACTIVE', 'OK', 'CONFIRMED', 'VIP', 'ANSWERED'].includes(value)) return 'badge-green'
  if (['PENDING', 'PREPARING', 'LOW', 'SCHEDULED', 'RETURNING', 'REGULAR', 'DRAFT'].includes(value)) return 'badge-yellow'
  if (['CANCELLED', 'FAILED', 'OUT', 'INACTIVE', 'TERMINATED', 'NEGATIVE'].includes(value)) return 'badge-red'
  if (['READY', 'SUSPENDED', 'PAUSED', 'OVER'].includes(value)) return 'badge-blue'
  return 'badge-gray'
}

export function paymentTone(status?: string) {
  const value = String(status || '').toUpperCase()
  if (value === 'PAID') return 'badge-green'
  if (value === 'PENDING') return 'badge-yellow'
  if (value === 'REFUNDED') return 'badge-blue'
  if (value === 'FAILED') return 'badge-red'
  return 'badge-gray'
}

export function toInputDate(value?: string | Date | null) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dayRange(days: number) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  return { start: toInputDate(start), end: toInputDate(end) }
}

export function relativeChange(value: number) {
  if (!Number.isFinite(value)) return '0%'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function truncate(value: string, length = 40) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

export function orderStatusLabel(status: string) {
  return titleCase(status)
}

export function initialsColor(name?: string) {
  const palette = [
    'bg-[#FFF0E8] text-[#D9532F]',
    'bg-[#EDF8F1] text-[#2F8C58]',
    'bg-[#EEF4FF] text-[#3569B4]',
    'bg-[#FDF6E6] text-[#9A7214]',
    'bg-[#F6EFFC] text-[#7C4BB0]',
  ]
  const index = String(name || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length
  return palette[index]
}

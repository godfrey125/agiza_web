import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

const tones = {
  orange: 'bg-brand-orange/12 text-brand-dark ring-brand-orange/20',
  dark: 'bg-brand-charcoal text-white ring-brand-charcoal/10',
  cream: 'bg-brand-cream text-brand-charcoal ring-brand-line',
  success: 'bg-brand-success/10 text-brand-success ring-brand-success/20',
  warning: 'bg-brand-warning/10 text-brand-warning ring-brand-warning/20',
  error: 'bg-brand-error/10 text-brand-error ring-brand-error/20',
  neutral: 'bg-white text-brand-muted ring-brand-line',
  inverse: 'bg-white/10 text-white/70 ring-white/15',
} as const

export function Badge({
  children,
  tone = 'cream',
  className,
}: {
  children: ReactNode
  tone?: keyof typeof tones
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusDot({ tone = 'orange' }: { tone?: 'orange' | 'success' | 'warning' | 'error' | 'muted' }) {
  const colours = {
    orange: 'bg-brand-orange',
    success: 'bg-brand-success',
    warning: 'bg-brand-warning',
    error: 'bg-brand-error',
    muted: 'bg-brand-muted',
  }
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', colours[tone])} aria-hidden="true" />
}

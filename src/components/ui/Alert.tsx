import { type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, ShieldCheck, TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/utils'

const styles = {
  info: {
    wrapper: 'border-brand-line bg-brand-cream text-brand-charcoal',
    icon: 'text-brand-dark',
    Icon: Info,
  },
  success: {
    wrapper: 'border-brand-success/20 bg-brand-success/5 text-brand-charcoal',
    icon: 'text-brand-success',
    Icon: CheckCircle2,
  },
  warning: {
    wrapper: 'border-brand-warning/25 bg-brand-warning/5 text-brand-charcoal',
    icon: 'text-brand-warning',
    Icon: TriangleAlert,
  },
  error: {
    wrapper: 'border-brand-error/20 bg-brand-error/5 text-brand-charcoal',
    icon: 'text-brand-error',
    Icon: AlertCircle,
  },
  secure: {
    wrapper: 'border-brand-charcoal/10 bg-brand-charcoal text-white',
    icon: 'text-brand-orange',
    Icon: ShieldCheck,
  },
} as const

export function Alert({
  children,
  tone = 'info',
  title,
  className,
  action,
}: {
  children?: ReactNode
  tone?: keyof typeof styles
  title?: string
  className?: string
  action?: ReactNode
}) {
  const style = styles[tone]
  const Icon = style.Icon
  return (
    <div className={cn('rounded-2xl border p-4 sm:p-5', style.wrapper, className)} role="status">
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.icon)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {title ? <p className="text-sm font-bold">{title}</p> : null}
          {children ? (
            <div className={cn('text-sm leading-6', title && 'mt-1', tone === 'secure' ? 'text-white/65' : 'text-brand-muted')}>
              {children}
            </div>
          ) : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  )
}

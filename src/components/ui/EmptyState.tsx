import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  body?: string
  action?: { label: string; to?: string; onClick?: () => void }
  className?: string
}) {
  return (
    <div className={cn('surface-card flex flex-col items-center px-6 py-12 text-center sm:px-10', className)}>
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-cream text-brand-dark ring-1 ring-brand-line">
        {icon}
      </span>
      <h3 className="mt-5 font-display text-xl font-bold tracking-tight text-brand-charcoal">{title}</h3>
      {body ? <p className="mt-2 max-w-md text-sm leading-6 text-brand-muted">{body}</p> : null}
      {action ? (
        action.to ? (
          <Link
            to={action.to}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-charcoal px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
          >
            {action.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-charcoal px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
          >
            {action.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )
      ) : null}
    </div>
  )
}

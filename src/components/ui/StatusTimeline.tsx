import { Check, Circle, Clock3, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export type TimelineState = 'done' | 'active' | 'pending' | 'error'

export interface TimelineItem {
  title: string
  description?: string
  date?: string
  state: TimelineState
}

export function StatusTimeline({ items, label }: { items: TimelineItem[]; label: string }) {
  return (
    <ol className="relative space-y-0" aria-label={label}>
      {items.map((item, index) => {
        const last = index === items.length - 1
        const Icon =
          item.state === 'done' ? Check : item.state === 'active' ? Clock3 : item.state === 'error' ? XCircle : Circle
        return (
          <li key={`${item.title}-${index}`} className="relative flex gap-4 pb-7 last:pb-0">
            {!last ? (
              <span
                className={cn(
                  'absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px',
                  item.state === 'done' ? 'bg-brand-orange/50' : 'bg-brand-line',
                )}
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border',
                item.state === 'done' && 'border-brand-orange bg-brand-orange text-white',
                item.state === 'active' && 'border-brand-charcoal bg-brand-charcoal text-white',
                item.state === 'pending' && 'border-brand-line bg-white text-brand-muted',
                item.state === 'error' && 'border-brand-error bg-brand-error/10 text-brand-error',
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn('text-sm font-bold', item.state === 'pending' ? 'text-brand-muted' : 'text-brand-charcoal')}>
                {item.title}
              </p>
              {item.description ? <p className="mt-1 text-xs leading-5 text-brand-muted">{item.description}</p> : null}
              {item.date ? (
                <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-brand-muted">{item.date}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

import { useId, type ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'

export function Accordion({
  items,
  className,
  defaultOpen = 0,
}: {
  items: Array<{ q: string; a: ReactNode }>
  className?: string
  defaultOpen?: number
}) {
  const baseId = useId()
  return (
    <div className={className}>
      {items.map((item, index) => (
        <details
          key={item.q}
          name={baseId}
          open={index === defaultOpen}
          className="group border-b border-brand-line py-1 last:border-b-0"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left [&::-webkit-details-marker]:hidden">
            <span className="font-display text-base font-bold leading-6 text-brand-charcoal sm:text-lg">{item.q}</span>
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-brand-line bg-white text-brand-charcoal transition group-open:border-brand-orange group-open:bg-brand-orange group-open:text-white">
              <Plus className="h-4 w-4 group-open:hidden" aria-hidden="true" />
              <Minus className="hidden h-4 w-4 group-open:block" aria-hidden="true" />
            </span>
          </summary>
          <div className="max-w-3xl pb-6 pr-8 text-sm leading-7 text-brand-muted">{item.a}</div>
        </details>
      ))}
    </div>
  )
}

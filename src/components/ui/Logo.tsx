import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useCopy } from '../../i18n'

export function Logo({ dark = false, className }: { dark?: boolean; className?: string }) {
  const c = useCopy()
  return (
    <Link
      to="/"
      className={cn('group inline-flex items-center gap-2.5 rounded-full', className)}
      aria-label={c.labels.agizaHome}
    >
      <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-brand-charcoal ring-1 ring-black/5">
        <img
          src="/agiza.png"
          alt=""
          width={40}
          height={40}
          className="h-full w-full object-cover"
          loading="eager"
        />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-[1.35rem] font-extrabold tracking-[-0.04em]',
            dark ? 'text-white' : 'text-brand-charcoal',
          )}
        >
          agiza
        </span>
        <span
          className={cn(
            'mt-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.25em]',
            dark ? 'text-white/50' : 'text-brand-muted',
          )}
        >
          Tanzania
        </span>
      </span>
    </Link>
  )
}

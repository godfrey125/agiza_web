import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('container-page', className)}>{children}</div>
}

export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('py-16 sm:py-20 lg:py-28', className)}>
      {children}
    </section>
  )
}

export function Eyebrow({ children, className, light }: { children: ReactNode; className?: string; light?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.22em]',
        light ? 'text-brand-orange' : 'text-brand-dark',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', light ? 'bg-brand-orange' : 'bg-brand-dark')} />
      {children}
    </span>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = 'left',
  light = false,
  className,
  action,
}: {
  eyebrow?: string
  title: ReactNode
  body?: string
  align?: 'left' | 'center'
  light?: boolean
  className?: string
  action?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-5',
        align === 'center' ? 'mx-auto max-w-3xl items-center text-center' : 'max-w-3xl',
        action && 'md:max-w-none md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className={cn('flex flex-col gap-4', align === 'center' ? 'items-center' : '')}>
        {eyebrow ? <Eyebrow light={light}>{eyebrow}</Eyebrow> : null}
        <h2
          className={cn(
            'font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.045em] sm:text-[2.6rem] lg:text-[3.25rem]',
            light ? 'text-white' : 'text-brand-charcoal',
          )}
        >
          {title}
        </h2>
        {body ? (
          <p
            className={cn(
              'max-w-2xl text-[0.98rem] leading-7 sm:text-base',
              light ? 'text-white/65' : 'text-brand-muted',
            )}
          >
            {body}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

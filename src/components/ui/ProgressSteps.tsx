import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ProgressStepsProps {
  steps: readonly string[]
  current: number
  maxReached?: number
  onStepClick?: (index: number) => void
  label: string
}

export function ProgressSteps({ steps, current, maxReached = current, onStepClick, label }: ProgressStepsProps) {
  const percent = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0

  return (
    <div aria-label={label}>
      <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
          {label} {current + 1} / {steps.length}
        </p>
        <p className="text-sm font-bold text-brand-charcoal">{steps[current]}</p>
      </div>

      <div className="hidden lg:block">
        <div className="relative">
          <div className="absolute left-0 right-0 top-5 h-px bg-brand-line" aria-hidden="true" />
          <div
            className="absolute left-0 top-5 h-px bg-brand-orange transition-all duration-500"
            style={{ width: `${percent}%` }}
            aria-hidden="true"
          />
          <ol className="relative grid gap-4" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((step, index) => {
              const done = index < current
              const active = index === current
              const reachable = index <= maxReached && Boolean(onStepClick)
              return (
                <li key={step} className="min-w-0">
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => onStepClick?.(index)}
                    className={cn(
                      'group flex w-full flex-col items-start gap-2 text-left',
                      reachable ? 'cursor-pointer' : 'cursor-default',
                    )}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span
                      className={cn(
                        'grid h-10 w-10 place-items-center rounded-full border text-xs font-bold transition',
                        done
                          ? 'border-brand-orange bg-brand-orange text-white'
                          : active
                            ? 'border-brand-charcoal bg-brand-charcoal text-white'
                            : 'border-brand-line bg-white text-brand-muted',
                        reachable && !active && 'group-hover:border-brand-orange/60',
                      )}
                    >
                      {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : String(index + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={cn(
                        'text-[0.72rem] font-semibold leading-5',
                        active || done ? 'text-brand-charcoal' : 'text-brand-muted',
                      )}
                    >
                      {step}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="h-1.5 overflow-hidden rounded-full bg-brand-line">
          <div
            className="h-full rounded-full bg-brand-orange transition-all duration-500"
            style={{ width: `${Math.max(6, percent)}%` }}
          />
        </div>
        <ol className="mt-4 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar" aria-label={label}>
          {steps.map((step, index) => {
            const done = index < current
            const active = index === current
            const reachable = index <= maxReached && Boolean(onStepClick)
            return (
              <li key={step} className="shrink-0">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => onStepClick?.(index)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[0.68rem] font-semibold transition',
                    active
                      ? 'border-brand-charcoal bg-brand-charcoal text-white'
                      : done
                        ? 'border-brand-orange/30 bg-brand-orange/10 text-brand-dark'
                        : 'border-brand-line bg-white text-brand-muted',
                  )}
                >
                  {index + 1}. {step}
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ClipboardCheck, LockKeyhole } from 'lucide-react'
import { useCopy } from '../../i18n'
import { Eyebrow } from '../ui/Layout'
import { ProgressSteps } from '../ui/ProgressSteps'

export function RegistrationShell({
  type,
  current,
  maxReached,
  onStepClick,
  children,
}: {
  type: 'vendor' | 'rider'
  current: number
  maxReached: number
  onStepClick: (step: number) => void
  children: ReactNode
}) {
  const c = useCopy()
  const details = c.register[type]
  const steps = c.register.steps[type]

  return (
    <>
      <section className="relative overflow-hidden border-b border-brand-line bg-brand-cream">
        <div
          className="pointer-events-none absolute -right-40 top-0 h-[420px] w-[420px] rounded-full bg-brand-orange/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="container-page relative py-10 sm:py-14 lg:py-16">
          <Link
            to={type === 'vendor' ? '/vendors' : '/riders'}
            className="inline-flex items-center gap-2 text-xs font-semibold text-brand-muted transition hover:text-brand-charcoal"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {c.common.back}
          </Link>
          <div className="mt-5 flex flex-col gap-5">
            <Eyebrow>{details.eyebrow}</Eyebrow>
            <h1 className="max-w-3xl font-display text-[2.4rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[3.4rem]">
              {details.title}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-brand-muted sm:text-base">{details.lead}</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 py-1.5 text-[0.68rem] font-semibold text-brand-muted">
                <LockKeyhole className="h-3.5 w-3.5 text-brand-dark" aria-hidden="true" />
                {c.register.secureNote}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 py-1.5 text-[0.68rem] font-semibold text-brand-muted">
                <ClipboardCheck className="h-3.5 w-3.5 text-brand-dark" aria-hidden="true" />
                {c.register.draftNote}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-8 sm:py-10 lg:py-12">
        <ProgressSteps
          steps={steps}
          current={current}
          maxReached={maxReached}
          onStepClick={onStepClick}
          label={c.common.step}
        />
        <div className="mt-8 grid items-start gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">{children}</div>
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-3xl border border-brand-line bg-white p-5">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
                {c.common.step} {current + 1} {c.common.of} {steps.length}
              </p>
              <p className="mt-2 text-sm font-bold text-brand-charcoal">{steps[current]}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-brand-line">
                <div
                  className="h-full rounded-full bg-brand-orange transition-all duration-500"
                  style={{ width: `${((current + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="rounded-3xl bg-brand-charcoal p-5 text-white">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-orange">
                {c.register.title}
              </p>
              <p className="mt-2 text-xs leading-5 text-white/60">{c.register.secureNote}</p>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

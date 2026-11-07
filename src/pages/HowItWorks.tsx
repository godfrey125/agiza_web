import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Bike, ShieldCheck, Store, Utensils } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'
import { Eyebrow, Section } from '../components/ui/Layout'
import { useCopy } from '../i18n'
import { cn } from '../lib/utils'

const tabs = [
  { icon: Utensils, href: 'customers' },
  { icon: Store, href: 'vendors' },
  { icon: Bike, href: 'riders' },
]

export function HowItWorks() {
  const c = useCopy()
  const [active, setActive] = useState(0)
  const data = [c.how.customers, c.how.vendors, c.how.riders][active]
  const ActiveIcon = tabs[active].icon

  return (
    <>
      <section className="relative overflow-hidden border-b border-brand-line">
        <div className="pointer-events-none absolute -right-40 top-0 h-[520px] w-[520px] rounded-full bg-brand-orange/15 blur-3xl" aria-hidden="true" />
        <div className="container-page relative py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <Eyebrow>{c.how.eyebrow}</Eyebrow>
            <h1 className="mt-5 font-display text-[2.8rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[4rem] lg:text-[4.6rem]">
              {c.how.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-brand-muted">{c.how.lead}</p>
          </div>
        </div>
      </section>

      <Section>
        <div className="container-page">
          <div role="tablist" aria-label={c.how.title} className="flex flex-wrap gap-2">
            {c.how.tabs.map((tab, index) => {
              const Icon = tabs[index].icon
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  id={`tab-${tabs[index].href}`}
                  aria-selected={active === index}
                  aria-controls={`panel-${tabs[index].href}`}
                  onClick={() => setActive(index)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition',
                    active === index
                      ? 'border-brand-charcoal bg-brand-charcoal text-white'
                      : 'border-brand-line bg-white text-brand-charcoal hover:border-brand-orange/40',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab}
                </button>
              )
            })}
          </div>

          <div
            role="tabpanel"
            id={`panel-${tabs[active].href}`}
            aria-labelledby={`tab-${tabs[active].href}`}
            className="mt-8"
          >
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"
            >
              <aside className="rounded-[2rem] bg-brand-charcoal p-7 text-white sm:p-9">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-orange text-white">
                  <ActiveIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-6 font-display text-2xl font-bold tracking-tight">{data.title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/55">
                  {c.how.lead}
                </p>
                <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="flex items-start gap-2.5 text-xs leading-5 text-white/65">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" aria-hidden="true" />
                    {c.how.noteBody}
                  </p>
                </div>
              </aside>

              <div className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-card sm:p-8">
                <ol className="space-y-0">
                  {data.steps.map((step, index) => (
                    <li key={step.title} className="relative flex gap-4 pb-7 last:pb-0">
                      {index < data.steps.length - 1 ? (
                        <span className="absolute left-[19px] top-10 h-[calc(100%-1.5rem)] w-px bg-brand-line" aria-hidden="true" />
                      ) : null}
                      <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-orange/10 text-sm font-extrabold text-brand-dark ring-1 ring-brand-orange/20">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 pt-1">
                        <h3 className="font-display text-base font-bold text-brand-charcoal sm:text-lg">{step.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-brand-muted">{step.description}</p>
                        {index === 2 && active === 2 ? (
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-warning/10 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-brand-warning">
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                            {c.labels.reviewRequired}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      <Section className="bg-white pt-0">
        <div className="container-page">
          <div className="rounded-[2.5rem] border border-brand-line bg-brand-cream/65 p-7 sm:p-10 lg:p-12">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-dark">
                  {c.how.noteTitle}
                </p>
                <h2 className="mt-4 max-w-2xl font-display text-[2rem] font-extrabold leading-[1.03] tracking-[-0.04em] text-brand-charcoal sm:text-[2.5rem]">
                  {c.how.ctaTitle}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-brand-muted">{c.how.ctaBody}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <ButtonLink to="/login" size="lg" className="whitespace-nowrap">
                  {c.nav.login}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ButtonLink>
                <ButtonLink to="/faq" size="lg" variant="secondary" className="whitespace-nowrap">
                  {c.footer.faq}
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}

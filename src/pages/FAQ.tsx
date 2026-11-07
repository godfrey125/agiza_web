import { ArrowRight, HelpCircle, MessageSquare, ShieldCheck } from 'lucide-react'
import { Accordion } from '../components/ui/Accordion'
import { ButtonLink } from '../components/ui/Button'
import { Eyebrow, Section } from '../components/ui/Layout'
import { useCopy } from '../i18n'

export function FAQ() {
  const c = useCopy()

  return (
    <>
      <section className="relative overflow-hidden border-b border-brand-line">
        <div
          className="pointer-events-none absolute -right-40 top-0 h-[460px] w-[460px] rounded-full bg-brand-orange/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="container-page relative py-12 sm:py-16 lg:py-20">
          <Eyebrow>{c.faq.eyebrow}</Eyebrow>
          <h1 className="mt-5 max-w-3xl font-display text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[3.8rem]">
            {c.faq.title}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-brand-muted sm:text-base">{c.faq.lead}</p>
        </div>
      </section>

      <Section>
        <div className="container-page grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="surface-card px-5 py-3 sm:px-8 sm:py-4">
            <Accordion items={c.faq.items} defaultOpen={0} />
          </div>
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-3xl bg-brand-charcoal p-6 text-white">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-brand-orange">
                <HelpCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-display text-xl font-bold tracking-tight">{c.faq.eyebrow}</h2>
              <p className="mt-2 text-sm leading-7 text-white/60">{c.faq.lead}</p>
              <ButtonLink to="/contact" variant="outline" size="sm" className="mt-5" fullWidth>
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                {c.nav.contact}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </ButtonLink>
            </div>
            <div className="rounded-3xl border border-brand-line bg-white p-6">
              <p className="flex items-center gap-2 text-xs font-bold text-brand-charcoal">
                <ShieldCheck className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                {c.home.trustTitle}
              </p>
              <p className="mt-2 text-xs leading-5 text-brand-muted">{c.home.trustBody}</p>
            </div>
          </aside>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="container-page">
          <div className="rounded-[2.5rem] bg-brand-cream p-7 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div>
              <h2 className="font-display text-[2rem] font-extrabold leading-[1.03] tracking-[-0.04em] text-brand-charcoal sm:text-[2.5rem]">
                {c.how.ctaTitle}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-brand-muted">{c.how.ctaBody}</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 lg:mt-0">
              <ButtonLink to="/register/vendor" size="lg">
                {c.common.registerBusiness}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to="/register/rider" size="lg" variant="secondary">
                {c.common.becomeRider}
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}

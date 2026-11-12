import { ArrowRight, ClipboardCheck, FileCheck2, ShieldCheck, Store, Utensils } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { Eyebrow, Section, SectionHeading } from '../components/ui/Layout'
import { useCopy } from '../i18n'

export function Vendors() {
  const c = useCopy()

  return (
    <>
      <section className="relative overflow-hidden border-b border-brand-line">
        <div className="pointer-events-none absolute -right-40 top-0 h-[500px] w-[500px] rounded-full bg-brand-orange/15 blur-3xl" aria-hidden="true" />
        <div className="container-page relative grid items-center gap-12 py-14 sm:py-18 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <Eyebrow>{c.vendors.eyebrow}</Eyebrow>
            <h1 className="mt-5 font-display text-[2.8rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[4rem] lg:text-[4.5rem]">
              {c.vendors.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-brand-muted">{c.vendors.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/register/vendor" size="lg">
                {c.common.registerBusiness}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to="/how-it-works" size="lg" variant="secondary">
                {c.how.eyebrow}
              </ButtonLink>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {c.vendors.whoTypes.slice(0, 5).map((type) => (
                <Badge key={type} tone="cream" className="bg-white/70">
                  {type}
                </Badge>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-[2.5rem]">
              <img
                src="/images/street-food.jpg"
                alt={c.labels.streetFoodAlt}
                className="h-[320px] w-full object-cover sm:h-[420px] lg:h-[500px]"
              />
            </div>
            <div className="absolute -bottom-4 left-4 right-4 rounded-2xl border border-brand-line bg-white p-4 shadow-soft sm:right-auto sm:max-w-xs">
              <p className="flex items-center gap-2 text-xs font-bold text-brand-charcoal">
                <Store className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                {c.labels.vendorHeroTitle}
              </p>
              <p className="mt-1 text-[0.68rem] leading-5 text-brand-muted">
                {c.labels.vendorHeroBody}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="container-page">
          <SectionHeading eyebrow={c.vendors.eyebrow} title={c.vendors.benefitsTitle} align="center" />
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {c.vendors.benefits.map((benefit) => (
              <div key={benefit} className="rounded-2xl border border-brand-line bg-white p-4">
                <span className="text-sm font-semibold leading-6 text-brand-charcoal">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="container-page grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading eyebrow={c.vendors.eyebrow} title={c.vendors.whoTitle} body={c.vendors.whoBody} />
            <div className="mt-6 flex flex-wrap gap-2">
              {c.vendors.whoTypes.map((type) => (
                <span key={type} className="rounded-full border border-brand-line bg-brand-cream/60 px-3.5 py-2 text-xs font-semibold text-brand-charcoal">
                  {type}
                </span>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-brand-line bg-brand-cream/50 p-5">
              <p className="flex items-start gap-2.5 text-sm leading-6 text-brand-muted">
                <Utensils className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden="true" />
                {c.home.vendorBody}
              </p>
            </div>
          </div>
          <div>
            <h3 className="font-display text-xl font-bold tracking-tight text-brand-charcoal">{c.vendors.processTitle}</h3>
            <ol className="mt-5 space-y-0">
              {c.vendors.process.map((step, index) => (
                <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
                  {index < c.vendors.process.length - 1 ? (
                    <span className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-brand-line" aria-hidden="true" />
                  ) : null}
                  <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-charcoal text-[0.62rem] font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm leading-6 text-brand-charcoal/80">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      <Section>
        <div className="container-page grid gap-5 md:grid-cols-2">
          <div className="surface-card p-7 sm:p-9">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-orange/10 text-brand-dark">
              <FileCheck2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-display text-xl font-bold tracking-tight text-brand-charcoal">{c.vendors.docsTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-brand-muted">{c.vendors.docsBody}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone="warning">{c.labels.mandatory}</Badge>
              <Badge tone="neutral">{c.labels.optional}</Badge>
              <Badge tone="neutral">{c.labels.configuredByAgiza}</Badge>
            </div>
          </div>
          <div className="rounded-3xl bg-brand-charcoal p-7 text-white sm:p-9">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-brand-orange">
              <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-display text-xl font-bold tracking-tight">{c.vendors.reviewTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-white/55">{c.vendors.reviewBody}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone="orange">{c.labels.pendingReview}</Badge>
              <Badge tone="orange">{c.labels.underReview}</Badge>
              <Badge tone="orange">{c.labels.decision}</Badge>
            </div>
          </div>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="container-page">
          <div className="rounded-[2.5rem] bg-brand-charcoal p-7 text-white sm:p-10 lg:p-14">
            <div className="grid min-w-0 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">
                  <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {c.labels.verifiedBeforeActive}
                </p>
                <h2 className="mt-4 max-w-2xl font-display text-[2rem] font-extrabold leading-[1.03] tracking-[-0.04em] sm:text-[2.6rem]">
                  {c.vendors.ctaTitle}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-white/55">{c.vendors.ctaBody}</p>
              </div>
              <ButtonLink
                to="/register/vendor"
                size="lg"
                className="w-full whitespace-normal text-center sm:w-auto sm:whitespace-nowrap"
              >
                {c.common.registerBusiness}
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}

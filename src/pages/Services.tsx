import {
  ArrowRight,
  Bike,
  MessageSquare,
  ShoppingBag,
  Store,
  Truck,
  Utensils,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { Eyebrow, Section, SectionHeading } from '../components/ui/Layout'
import { useCopy } from '../i18n'

const icons = [Utensils, Store, Truck, MessageSquare, ShoppingBag, Bike]

export function Services() {
  const c = useCopy()

  return (
    <>
      <section className="relative overflow-hidden border-b border-brand-line">
        <div className="pointer-events-none absolute -right-40 top-0 h-[520px] w-[520px] rounded-full bg-brand-orange/15 blur-3xl" aria-hidden="true" />
        <div className="container-page relative py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <Eyebrow>{c.services.eyebrow}</Eyebrow>
            <h1 className="mt-5 font-display text-[2.8rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[4rem] lg:text-[4.6rem]">
              {c.services.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-brand-muted">{c.services.lead}</p>
            <div className="mt-8 flex flex-wrap gap-2">
              <Badge tone="orange">{c.labels.dineIn}</Badge>
              <Badge tone="orange">{c.labels.delivery}</Badge>
              <Badge tone="orange">{c.labels.customRequests}</Badge>
              <Badge tone="neutral">{c.labels.vendorMarketplace}</Badge>
              <Badge tone="neutral">{c.labels.riderNetwork}</Badge>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="container-page">
          <div className="grid gap-5 lg:grid-cols-2">
            {c.services.items.map((item, index) => {
              const Icon = icons[index]
              const href =
                index === 4 ? '/vendors' : index === 5 ? '/riders' : '/login'
              return (
                <div
                  key={item.title}
                  className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-brand-line bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft sm:p-8"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-cream text-brand-dark ring-1 ring-brand-line transition group-hover:bg-brand-orange group-hover:text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-display text-3xl font-extrabold tracking-tighter text-brand-line">
                      0{index + 1}
                    </span>
                  </div>
                  <h2 className="mt-6 font-display text-2xl font-bold tracking-tight text-brand-charcoal">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-brand-charcoal/75">{item.description}</p>
                  <p className="mt-4 flex-1 text-sm leading-6 text-brand-muted">{item.detail}</p>
                  <div className="mt-6 border-t border-brand-line pt-5">
                    <Link to={href} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-dark">
                      {item.cta}
                      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="container-page">
          <SectionHeading eyebrow={c.services.eyebrow} title={c.services.ctaTitle} body={c.services.ctaBody} align="center" />
          <div className="mx-auto mt-9 grid max-w-4xl gap-4 sm:grid-cols-3">
            <ButtonLink to="/how-it-works" size="lg" variant="secondary" fullWidth>
              {c.how.eyebrow}
            </ButtonLink>
            <ButtonLink to="/vendors" size="lg" variant="secondary" fullWidth>
              {c.vendors.eyebrow}
            </ButtonLink>
            <ButtonLink to="/riders" size="lg" variant="secondary" fullWidth>
              {c.riders.eyebrow}
            </ButtonLink>
          </div>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="container-page">
          <div className="rounded-[2.5rem] bg-brand-charcoal p-7 text-white sm:p-10 lg:p-14">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <h2 className="max-w-2xl font-display text-[2rem] font-extrabold leading-[1.03] tracking-[-0.04em] sm:text-[2.6rem]">
                  {c.how.noteTitle}: {c.services.ctaTitle}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-white/55">{c.services.ctaBody}</p>
              </div>
              <ButtonLink to="/login" size="lg" className="whitespace-nowrap">
                {c.nav.login}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}

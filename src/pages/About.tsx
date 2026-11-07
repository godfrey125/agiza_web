import { ArrowRight, Bike, ChefHat, HeartHandshake, MessageSquare, ShieldCheck, Store, UsersRound } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { Eyebrow, Section, SectionHeading } from '../components/ui/Layout'
import { useCopy } from '../i18n'

export function About() {
  const c = useCopy()
  const roleIcons = [UsersRound, Store, Bike, ShieldCheck]
  const valueIcons = [ShieldCheck, HeartHandshake, ChefHat, MessageSquare]

  return (
    <>
      <section className="relative overflow-hidden border-b border-brand-line">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-orange/15 blur-3xl" aria-hidden="true" />
        <div className="container-page relative grid items-end gap-10 pb-16 pt-14 sm:pb-20 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Eyebrow>{c.about.eyebrow}</Eyebrow>
            <h1 className="mt-5 max-w-3xl font-display text-[2.8rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[4rem] lg:text-[4.6rem]">
              {c.about.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-brand-muted">{c.about.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/get-started" size="lg">
                {c.common.becomePartner}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to="/services" size="lg" variant="secondary">
                {c.common.viewServices}
              </ButtonLink>
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-[2rem] bg-brand-charcoal">
              <img
                src="/images/food-table.jpg"
                alt={c.labels.sharedTableAlt}
                className="h-64 w-full object-cover sm:h-80 lg:h-96"
              />
            </div>
            <div className="absolute -bottom-5 -left-3 rounded-2xl border border-brand-line bg-white p-4 shadow-soft sm:left-5">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
                {c.labels.builtInTanzania}
              </p>
              <p className="mt-1 flex items-center gap-2 font-display text-sm font-bold text-brand-charcoal">
                <span className="h-2 w-2 rounded-full bg-brand-success" aria-hidden="true" />
                {c.labels.forLocalFoodBusinesses}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="container-page grid gap-5 md:grid-cols-2">
          <div className="surface-card p-7 sm:p-9">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-orange/10 text-brand-dark">
              <HeartHandshake className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-6 font-display text-2xl font-bold tracking-tight text-brand-charcoal">{c.about.missionTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-brand-muted">{c.about.missionBody}</p>
          </div>
          <div className="rounded-3xl bg-brand-charcoal p-7 text-white sm:p-9">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-brand-orange">
              <ChefHat className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-6 font-display text-2xl font-bold tracking-tight">{c.about.visionTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-white/60">{c.about.visionBody}</p>
          </div>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="relative order-2 lg:order-1">
            <div className="overflow-hidden rounded-[2rem]">
              <img
                src="/images/kitchen.jpg"
                alt={c.labels.kitchenAlt}
                className="h-80 w-full object-cover sm:h-[440px]"
                loading="lazy"
              />
            </div>
            <div className="absolute -right-3 top-6 hidden rounded-2xl bg-brand-orange px-4 py-3 text-white shadow-glow sm:block">
              <p className="font-display text-sm font-bold">{c.labels.localFirst}</p>
              <p className="mt-0.5 text-[0.62rem] text-white/75">{c.labels.foodBusinesses}</p>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <SectionHeading eyebrow={c.about.eyebrow} title={c.about.supportTitle} body={c.about.supportBody} />
            <div className="mt-7 space-y-3">
              {c.about.supportCards.map((card) => (
                <div key={card.title} className="rounded-2xl border border-brand-line bg-brand-cream/45 p-4">
                  <p className="text-sm font-bold text-brand-charcoal">{card.title}</p>
                  <p className="mt-1 text-xs leading-5 text-brand-muted">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="container-page">
          <SectionHeading eyebrow={c.about.eyebrow} title={c.about.rolesTitle} align="center" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {c.about.roles.map((role, index) => {
              const Icon = roleIcons[index]
              return (
                <div key={role.title} className="surface-card p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-cream text-brand-dark ring-1 ring-brand-line">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-brand-charcoal">{role.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">{role.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      <Section className="bg-brand-charcoal text-white">
        <div className="container-page">
          <SectionHeading eyebrow={c.about.valuesTitle} title={c.about.valuesTitle} light />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {c.about.values.map((value, index) => {
              const Icon = valueIcons[index]
              return (
                <div key={value.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-orange text-white">
                      <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                    </span>
                    <h3 className="font-display text-lg font-bold">{value.title}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/55">{value.description}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            <Badge tone="orange">{c.labels.customers}</Badge>
            <Badge tone="orange">{c.labels.vendors}</Badge>
            <Badge tone="orange">{c.labels.riders}</Badge>
            <Badge tone="neutral">{c.labels.verifiedPartners}</Badge>
          </div>
        </div>
      </Section>

      <Section>
        <div className="container-page">
          <div className="rounded-[2.5rem] border border-brand-line bg-white px-6 py-10 text-center shadow-card sm:px-12 sm:py-14">
            <h2 className="mx-auto max-w-2xl font-display text-[2rem] font-extrabold tracking-[-0.04em] text-brand-charcoal sm:text-[2.6rem]">
              {c.about.ctaTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-brand-muted">{c.about.ctaBody}</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink to="/register/vendor" size="lg">
                {c.common.registerBusiness}
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

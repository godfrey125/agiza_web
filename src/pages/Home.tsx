import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bike,
  ChefHat,
  ClipboardList,
  HeartHandshake,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Utensils,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Accordion } from '../components/ui/Accordion'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { Eyebrow, Section, SectionHeading } from '../components/ui/Layout'
import { AppAvailabilitySection } from '../components/home/AppAvailabilitySection'
import { PhoneMockup } from '../components/home/PhoneMockup'
import { useCopy } from '../i18n'

const serviceIcons = [Utensils, Store, Truck, MessageSquare, ShoppingBag, Bike]
const trustIcons = [ClipboardList, ShieldCheck, LockKeyhole]

export function Home() {
  const c = useCopy()

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 top-10 h-[620px] w-[620px] rounded-full bg-brand-orange/15 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-brand-orange/10 blur-3xl" aria-hidden="true" />
        <div className="container-page relative grid items-center gap-14 pb-16 pt-12 sm:pb-20 sm:pt-16 lg:grid-cols-[1.03fr_0.97fr] lg:gap-10 lg:pb-28 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10"
          >
            <Eyebrow>{c.home.eyebrow}</Eyebrow>
            <h1 className="mt-5 font-display text-[3.35rem] font-extrabold leading-[0.92] tracking-[-0.065em] text-brand-charcoal sm:text-[4.6rem] lg:text-[5.35rem]">
              <span className="block">{c.home.headlineTop}</span>
              <span className="block text-brand-orange">{c.home.headlineBottom}</span>
            </h1>

            <p className="mt-7 max-w-xl font-display text-lg font-bold leading-7 tracking-tight text-brand-charcoal sm:text-xl sm:leading-8">
              {c.home.supportingHeading}
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-brand-muted sm:text-base">
              {c.home.description}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink to="/services" size="lg" className="group">
                {c.common.exploreAgiza}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to="/get-started" size="lg" variant="dark">
                {c.common.becomePartner}
              </ButtonLink>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {c.home.heroChips.map((chip) => (
                <Badge key={chip} tone="cream" className="bg-white/70 text-brand-charcoal">
                  {chip}
                </Badge>
              ))}
            </div>

            <div className="mt-9 grid gap-3 border-t border-brand-line pt-6 sm:grid-cols-3">
              {[
                { icon: Store, label: c.home.capabilityOne },
                { icon: Bike, label: c.home.capabilityTwo },
                { icon: ShieldCheck, label: c.home.capabilityThree },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden="true" />
                  <span className="text-xs font-semibold leading-5 text-brand-charcoal/75">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.85, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <PhoneMockup />
          </motion.div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="container-page">
        <div className="grid divide-y divide-brand-line overflow-hidden rounded-3xl border border-brand-line bg-white shadow-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { icon: Store, title: c.home.capabilityOne, text: c.home.servicesBody },
            { icon: UsersRound, title: c.home.capabilityTwo, text: c.home.riderBody },
            { icon: ShieldCheck, title: c.home.capabilityThree, text: c.home.trustBody },
          ].map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="flex gap-4 p-6 sm:p-7">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-cream text-brand-dark ring-1 ring-brand-line">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-brand-charcoal">{title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-brand-muted">{text}</p>
              </div>
              <span className="ml-auto hidden text-[0.62rem] font-bold text-brand-line sm:block">0{index + 1}</span>
            </div>
          ))}
        </div>
      </div>

      <AppAvailabilitySection />

      {/* About */}
      <Section>
        <div className="container-page">
          <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
            <div className="relative">
              <div className="overflow-hidden rounded-[2.5rem] bg-brand-charcoal">
                <img
                  src="/images/kitchen.jpg"
                  alt={c.labels.kitchenAlt}
                  className="h-[430px] w-full object-cover sm:h-[520px]"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-5 left-5 right-5 rounded-2xl border border-brand-line bg-white p-4 shadow-soft sm:left-8 sm:right-auto sm:max-w-xs">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-orange/10 text-brand-dark">
                    <ChefHat className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-brand-charcoal">{c.labels.localKitchensTitle}</p>
                    <p className="mt-0.5 text-[0.68rem] leading-4 text-brand-muted">
                      {c.labels.localKitchensBody}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <SectionHeading eyebrow={c.home.aboutEyebrow} title={c.home.aboutTitle} body={c.home.aboutLead} />
              <p className="mt-5 text-sm leading-7 text-brand-muted">{c.home.aboutBody}</p>
              <p className="mt-3 text-sm leading-7 text-brand-muted">{c.home.aboutBodyTwo}</p>
              <div className="mt-7 flex flex-wrap gap-2">
                <Badge tone="orange">{c.labels.dineIn}</Badge>
                <Badge tone="orange">{c.labels.delivery}</Badge>
                <Badge tone="orange">{c.labels.customRequests}</Badge>
                <Badge tone="neutral">{c.labels.vendors}</Badge>
                <Badge tone="neutral">{c.labels.riders}</Badge>
              </div>
              <div className="mt-8">
                <ButtonLink to="/about" variant="secondary">
                  {c.common.learnMore}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ButtonLink>
              </div>
            </div>
          </div>

          <div className="mt-16 lg:mt-24">
            <SectionHeading
              eyebrow={c.home.experienceEyebrow}
              title={c.home.experienceTitle}
              body={c.home.experienceBody}
              align="center"
            />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {c.home.experienceCards.map((card, index) => {
                const Icon = [Utensils, Truck, MessageSquare][index]
                return (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                    className="surface-card group relative overflow-hidden p-6 transition hover:-translate-y-0.5 hover:shadow-soft sm:p-7"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-cream text-brand-dark ring-1 ring-brand-line transition group-hover:bg-brand-orange group-hover:text-white">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-brand-line">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-6 font-display text-xl font-bold tracking-tight text-brand-charcoal">{card.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-brand-muted">{card.description}</p>
                    <p className="mt-5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-brand-dark">
                      {card.detail}
                    </p>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* Services */}
      <Section className="bg-white">
        <div className="container-page">
          <SectionHeading
            eyebrow={c.home.servicesEyebrow}
            title={c.home.servicesTitle}
            body={c.home.servicesBody}
            action={
              <ButtonLink to="/services" variant="secondary">
                {c.home.allServices}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            }
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.services.items.map((item, index) => {
              const Icon = serviceIcons[index]
              return (
                <Link
                  key={item.title}
                  to={index === 4 ? '/vendors' : index === 5 ? '/riders' : '/services'}
                  className="group relative flex flex-col rounded-3xl border border-brand-line bg-brand-cream/45 p-6 transition hover:border-brand-orange/40 hover:bg-white hover:shadow-card sm:p-7"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-brand-dark shadow-sm ring-1 ring-brand-line transition group-hover:bg-brand-orange group-hover:text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-brand-charcoal">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-brand-muted">{item.description}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-brand-dark">
                    {item.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </Section>

      {/* How it works */}
      <Section className="relative overflow-hidden bg-brand-charcoal text-white">
        <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-brand-orange/10 blur-3xl" aria-hidden="true" />
        <div className="container-page relative">
          <SectionHeading
            eyebrow={c.home.howEyebrow}
            title={c.home.howTitle}
            body={c.home.howBody}
            light
            action={
              <ButtonLink to="/how-it-works" variant="outline">
                {c.home.howCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            }
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {[
              { title: c.how.tabs[0], data: c.how.customers, icon: Utensils },
              { title: c.how.tabs[1], data: c.how.vendors, icon: Store },
              { title: c.how.tabs[2], data: c.how.riders, icon: Bike },
            ].map(({ title, data, icon: Icon }, columnIndex) => (
              <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-orange text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="font-display text-lg font-bold">{title}</h3>
                  </div>
                  <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-white/25">0{columnIndex + 1}</span>
                </div>
                <ol className="mt-6 space-y-4">
                  {data.steps.slice(0, 3).map((step, index) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 text-[0.6rem] font-bold text-brand-orange">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{step.title}</p>
                        <p className="mt-0.5 text-xs leading-5 text-white/50">{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-6 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/35">
                  + {data.steps.length - 3} more steps
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-brand-orange/20 bg-brand-orange/10 p-5">
            <p className="flex items-start gap-3 text-sm leading-6 text-white/70">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" aria-hidden="true" />
              <span>
                <span className="font-bold text-white">{c.how.noteTitle}: </span>
                {c.how.noteBody}
              </span>
            </p>
          </div>
        </div>
      </Section>

      {/* Vendors */}
      <Section>
        <div className="container-page">
          <div className="overflow-hidden rounded-[2.5rem] bg-brand-charcoal text-white">
            <div className="grid lg:grid-cols-2">
              <div className="order-2 p-8 sm:p-10 lg:order-1 lg:p-14">
                <Eyebrow light>{c.home.vendorEyebrow}</Eyebrow>
                <h2 className="mt-5 font-display text-[2rem] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-[2.6rem] lg:text-[3rem]">
                  {c.home.vendorTitle}
                </h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-white/60">{c.home.vendorBody}</p>
                <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
                  {c.home.vendorBenefits.map((benefit) => (
                    <li key={benefit} className="text-sm leading-6 text-white/75">
                      {benefit}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <ButtonLink to="/register/vendor" size="lg">
                    {c.common.registerBusiness}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </ButtonLink>
                  <ButtonLink to="/vendors" size="lg" variant="outline">
                    {c.common.learnMore}
                  </ButtonLink>
                </div>
              </div>
              <div className="relative order-1 min-h-72 lg:order-2">
                <img
                  src="/images/food-table.jpg"
                  alt={c.labels.tableAlt}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal via-brand-charcoal/10 to-transparent lg:bg-gradient-to-r" />
                <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur-md sm:left-auto sm:max-w-xs">
                  <p className="flex items-center gap-2 text-xs font-bold text-white">
                    <Store className="h-4 w-4 text-brand-orange" aria-hidden="true" />
                    {c.labels.vendorCardTitle}
                  </p>
                  <p className="mt-1 text-[0.68rem] leading-5 text-white/65">
                    {c.labels.vendorCardBody}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Riders */}
      <Section className="bg-white pt-0">
        <div className="container-page">
          <div className="grid items-center gap-10 rounded-[2.5rem] border border-brand-line bg-brand-cream/55 p-6 sm:p-8 lg:grid-cols-2 lg:gap-16 lg:p-12">
            <div className="relative overflow-hidden rounded-[2rem]">
              <img
                src="/images/rider.jpg"
                alt={c.labels.riderAlt}
                className="h-80 w-full object-cover sm:h-[420px]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/95 p-4 shadow-soft backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-orange/10 text-brand-dark">
                    <Bike className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-brand-charcoal">{c.labels.riderNetworkTitle}</p>
                    <p className="mt-0.5 text-[0.68rem] text-brand-muted">{c.labels.riderNetworkBody}</p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <Eyebrow>{c.home.riderEyebrow}</Eyebrow>
              <h2 className="mt-4 font-display text-[2rem] font-extrabold leading-[1.04] tracking-[-0.045em] text-brand-charcoal sm:text-[2.5rem]">
                {c.home.riderTitle}
              </h2>
              <p className="mt-4 text-sm leading-7 text-brand-muted">{c.home.riderBody}</p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {c.home.riderBenefits.map((benefit) => (
                  <li key={benefit} className="text-sm leading-6 text-brand-charcoal/75">
                    {benefit}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink to="/register/rider" size="lg">
                  {c.common.becomeRider}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ButtonLink>
                <ButtonLink to="/riders" size="lg" variant="secondary">
                  {c.common.learnMore}
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Trust */}
      <Section>
        <div className="container-page">
          <SectionHeading
            eyebrow={c.home.trustEyebrow}
            title={c.home.trustTitle}
            body={c.home.trustBody}
            align="center"
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {c.home.trustCards.map((card, index) => {
              const Icon = trustIcons[index]
              return (
                <div key={card.title} className="surface-card p-6 sm:p-7">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-charcoal text-brand-orange">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-brand-charcoal">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">{card.description}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-brand-line bg-white p-5">
            <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" aria-hidden="true" />
            <p className="text-sm leading-6 text-brand-muted">
              <span className="font-bold text-brand-charcoal">{c.how.noteTitle}: </span>
              {c.how.noteBody}
            </p>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section className="bg-white">
        <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <SectionHeading eyebrow={c.home.faqEyebrow} title={c.home.faqTitle} />
            <p className="mt-5 text-sm leading-7 text-brand-muted">{c.faq.lead}</p>
            <ButtonLink to="/faq" variant="secondary" className="mt-6">
              {c.home.faqCta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          </div>
          <div className="surface-card px-5 sm:px-7">
            <Accordion items={c.faq.items.slice(0, 5).map((item) => ({ q: item.q, a: item.a }))} />
          </div>
        </div>
      </Section>

      {/* Final CTA */}
      <Section className="pb-20 pt-4 sm:pb-24 sm:pt-8">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-orange px-6 py-12 sm:px-10 sm:py-14 lg:px-16">
            <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-brand-dark/30 blur-3xl" aria-hidden="true" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <Eyebrow className="text-white/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  {c.home.eyebrow}
                </Eyebrow>
                <h2 className="mt-4 max-w-2xl font-display text-[2.1rem] font-extrabold leading-[1.02] tracking-[-0.045em] text-white sm:text-[2.8rem]">
                  {c.home.finalTitle}
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/80">{c.home.finalBody}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <ButtonLink to="/login" variant="dark" size="lg" className="whitespace-nowrap">
                  {c.nav.login}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ButtonLink>
                <ButtonLink to="/services" variant="outline" size="lg" className="whitespace-nowrap border-white/40">
                  {c.common.viewServices}
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}

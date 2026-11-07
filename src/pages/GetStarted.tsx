import { ArrowRight, Bike, ClipboardCheck, LockKeyhole, ShieldCheck, ShoppingBag, Store, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { Eyebrow, Section } from '../components/ui/Layout'
import { useCopy } from '../i18n'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/utils'

export function GetStarted() {
  const c = useCopy()
  const { isAuthenticated, user } = useAuth()

  const paths = [
    {
      key: 'vendor',
      icon: Store,
      eyebrow: c.vendors.eyebrow,
      title: c.register.vendor.title,
      body: c.vendors.lead,
      to: '/register/vendor',
      cta: c.common.registerBusiness,
      points: c.home.vendorBenefits.slice(0, 4),
      theme: 'light' as const,
    },
    {
      key: 'rider',
      icon: Bike,
      eyebrow: c.riders.eyebrow,
      title: c.register.rider.title,
      body: c.riders.lead,
      to: '/register/rider',
      cta: c.common.becomeRider,
      points: c.home.riderBenefits.slice(0, 4),
      theme: 'dark' as const,
    },
  ]

  return (
    <>
      <section className="relative overflow-hidden border-b border-brand-line">
        <div className="pointer-events-none absolute -right-40 top-0 h-[520px] w-[520px] rounded-full bg-brand-orange/15 blur-3xl" aria-hidden="true" />
        <div className="container-page relative py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <Eyebrow>{c.nav.getStarted}</Eyebrow>
            <h1 className="mt-5 font-display text-[2.8rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[4rem] lg:text-[4.6rem]">
              {c.how.ctaTitle}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-brand-muted">{c.how.ctaBody}</p>
            {isAuthenticated && user ? (
              <div className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm">
                <UserRound className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                <span className="text-brand-muted">{c.nav.signedInAs}</span>
                <span className="font-bold text-brand-charcoal">{user.username}</span>
                <Link to="/application-status" className="ml-1 font-bold text-brand-dark underline underline-offset-4">
                  {c.nav.status}
                </Link>
              </div>
            ) : (
              <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm text-brand-muted">
                <ShieldCheck className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                {c.register.signInBody}
              </div>
            )}
          </div>
        </div>
      </section>

      <Section>
        <div className="container-page">
          <div className="grid gap-5 lg:grid-cols-2">
            {paths.map(({ key, icon: Icon, eyebrow, title, body, to, cta, points, theme }) => (
              <div
                key={key}
                className={cn(
                  'flex flex-col rounded-[2rem] border p-6 sm:p-8 lg:p-10',
                  theme === 'dark'
                    ? 'border-brand-charcoal bg-brand-charcoal text-white'
                    : 'border-brand-line bg-white text-brand-charcoal shadow-card',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={cn(
                      'grid h-12 w-12 place-items-center rounded-2xl',
                      theme === 'dark' ? 'bg-brand-orange text-white' : 'bg-brand-orange/10 text-brand-dark',
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <Badge tone={theme === 'dark' ? 'orange' : 'neutral'}>{eyebrow}</Badge>
                </div>
                <h2 className="mt-6 font-display text-2xl font-extrabold leading-tight tracking-[-0.03em] sm:text-3xl">{title}</h2>
                <p className={cn('mt-3 text-sm leading-7', theme === 'dark' ? 'text-white/55' : 'text-brand-muted')}>{body}</p>
                <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {points.map((point) => (
                    <li key={point} className={cn('text-xs leading-5', theme === 'dark' ? 'text-white/70' : 'text-brand-charcoal/75')}>
                      {point}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <ButtonLink to={to} size="lg" variant={theme === 'dark' ? 'primary' : 'dark'} fullWidth>
                    {cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </ButtonLink>
                  <p className={cn('mt-3 text-center text-[0.68rem] leading-5', theme === 'dark' ? 'text-white/40' : 'text-brand-muted')}>
                    {c.register.alreadyApplied}{' '}
                    <Link to="/application-status" className="font-semibold underline underline-offset-4">
                      {c.register.viewStatus}
                    </Link>
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="surface-card flex items-start gap-4 p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-cream text-brand-dark ring-1 ring-brand-line">
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-brand-charcoal">{c.services.items[0].title}</h3>
                <p className="mt-1 text-sm leading-6 text-brand-muted">{c.services.items[0].detail}</p>
                <Link to="/services" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-dark">
                  {c.common.learnMore}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="surface-card flex items-start gap-4 p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-cream text-brand-dark ring-1 ring-brand-line">
                <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-brand-charcoal">{c.status.signInTitle}</h3>
                <p className="mt-1 text-sm leading-6 text-brand-muted">{c.status.lead}</p>
                <Link to="/application-status" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-dark">
                  {c.status.view}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section className="bg-white pt-0">
        <div className="container-page">
          <div className="rounded-[2.5rem] border border-brand-line bg-brand-cream/60 p-7 sm:p-10">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.03em] text-brand-charcoal">{c.register.secureNote}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, title: c.home.trustCards[0].title, body: c.home.trustCards[0].description },
                { icon: ClipboardCheck, title: c.home.trustCards[1].title, body: c.home.trustCards[1].description },
                { icon: LockKeyhole, title: c.home.trustCards[2].title, body: c.home.trustCards[2].description },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-brand-line bg-white p-4">
                  <Icon className="h-5 w-5 text-brand-dark" aria-hidden="true" />
                  <p className="mt-3 text-sm font-bold text-brand-charcoal">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-brand-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}

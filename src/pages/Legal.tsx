import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { ButtonLink } from '../components/ui/Button'
import { Eyebrow } from '../components/ui/Layout'
import { useCopy } from '../i18n'
import { siteConfig } from '../lib/config'

interface LegalSection {
  title: string
  body: string
}

function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow: string
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}) {
  const c = useCopy()

  return (
    <>
      <section className="border-b border-brand-line bg-brand-cream">
        <div className="container-page py-12 sm:py-16">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-5 max-w-3xl font-display text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[3.6rem]">
            {title}
          </h1>
          <p className="mt-4 text-sm font-semibold text-brand-muted">{updated}</p>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-brand-muted">{intro}</p>
        </div>
      </section>

      <section className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-4xl">
          <Alert tone="warning" title={c.legal.bannerTitle} className="mb-8">
            {c.legal.bannerBody}
          </Alert>

          <div className="legal-prose rounded-3xl border border-brand-line bg-white p-6 sm:p-10">
            {sections.map((section, index) => (
              <section key={section.title} className={index > 0 ? 'mt-8 border-t border-brand-line pt-8' : ''}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-cream text-[0.65rem] font-bold text-brand-dark ring-1 ring-brand-line">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-bold tracking-tight text-brand-charcoal">{section.title}</h2>
                    <p className="mt-2">{section.body}</p>
                  </div>
                </div>
              </section>
            ))}

            <div className="mt-8 border-t border-brand-line pt-8">
              <p className="flex items-start gap-2 text-xs leading-5 text-brand-muted">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-warning" aria-hidden="true" />
                {c.footer.legalReview}
              </p>
              {siteConfig.legal.entityName ? (
                <p className="mt-2 text-xs text-brand-muted">{siteConfig.legal.entityName}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-brand-charcoal p-6 text-white">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">{c.legal.bannerTitle}</p>
                <p className="mt-1 max-w-xl text-xs leading-5 text-white/55">{c.footer.legalReview}</p>
              </div>
            </div>
            <ButtonLink to="/contact" variant="outline" size="sm">
              {c.nav.contact}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  )
}

export function Privacy() {
  const c = useCopy()
  return (
    <LegalPage
      eyebrow={c.legal.privacyTitle}
      title={c.legal.privacyTitle}
      updated={c.legal.privacyUpdated}
      intro={c.legal.privacyIntro}
      sections={c.legal.privacySections}
    />
  )
}

export function Terms() {
  const c = useCopy()
  return (
    <LegalPage
      eyebrow={c.legal.termsTitle}
      title={c.legal.termsTitle}
      updated={c.legal.termsUpdated}
      intro={c.legal.termsIntro}
      sections={c.legal.termsSections}
    />
  )
}

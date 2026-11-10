import { Link } from 'react-router-dom'
import { ArrowUpRight, Download, LockKeyhole } from 'lucide-react'
import { useI18n } from '../../i18n'
import { siteConfig } from '../../lib/config'
import { Logo } from '../ui/Logo'

const linkClass = 'text-sm text-brand-muted transition hover:text-brand-charcoal'

export function Footer() {
  const { c, lang, setLang } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-brand-line bg-brand-cream">
      <div className="container-page py-14 sm:py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.25fr_2fr]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-5 font-display text-lg font-bold tracking-tight text-brand-charcoal">
              {c.footer.tagline}
            </p>
            <p className="mt-2 text-sm leading-6 text-brand-muted">{c.footer.description}</p>

            <div className="mt-6 flex items-center gap-2">
              <img src="/badges/globe.svg" alt="" aria-hidden="true" className="h-4 w-4" />
              <div className="inline-flex rounded-full border border-brand-line bg-white p-0.5 text-xs">
                {(['en', 'sw'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLang(option)}
                    aria-pressed={lang === option}
                    className={
                      lang === option
                        ? 'rounded-full bg-brand-charcoal px-3 py-1.5 font-bold uppercase tracking-[0.08em] text-white'
                        : 'rounded-full px-3 py-1.5 font-bold uppercase tracking-[0.08em] text-brand-muted hover:text-brand-charcoal'
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {siteConfig.app.apkUrl ? (
              <a
                href={siteConfig.app.apkUrl}
                download
                className="group mt-6 flex max-w-sm items-center gap-3 rounded-2xl border border-brand-line bg-white p-3.5 transition hover:border-brand-charcoal/25 hover:bg-white/80"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-charcoal text-brand-orange">
                  <Download className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-brand-charcoal">
                    {c.footer.installApp}
                  </span>
                  <span className="mt-0.5 block text-[0.68rem] text-brand-muted">
                    {c.footer.installBody}
                  </span>
                </span>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-brand-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-dark"
                  aria-hidden="true"
                />
              </a>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-brand-charcoal">
                {c.footer.explore}
              </p>
              <ul className="mt-4 space-y-3">
                <li><Link className={linkClass} to="/about">{c.footer.about}</Link></li>
                <li><Link className={linkClass} to="/services">{c.footer.services}</Link></li>
                <li><Link className={linkClass} to="/how-it-works">{c.footer.how}</Link></li>
                <li><Link className={linkClass} to="/faq">{c.footer.faq}</Link></li>
                <li><Link className={linkClass} to="/contact">{c.footer.contact}</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-brand-charcoal">
                {c.footer.partners}
              </p>
              <ul className="mt-4 space-y-3">
                <li><Link className={linkClass} to="/vendors">{c.footer.vendor}</Link></li>
                <li><Link className={linkClass} to="/riders">{c.footer.rider}</Link></li>
                <li><Link className={linkClass} to="/register/vendor">{c.nav.vendorRegister}</Link></li>
                <li><Link className={linkClass} to="/register/rider">{c.nav.riderRegister}</Link></li>
                <li><Link className={linkClass} to="/application-status">{c.footer.status}</Link></li>
                <li><a className={linkClass} href={siteConfig.analyticsUrl} target="_blank" rel="noreferrer">{c.footer.analytics}</a></li>
              </ul>
            </div>
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-brand-charcoal">
                {c.footer.support}
              </p>
              <ul className="mt-4 space-y-3">
                <li><Link className={linkClass} to="/faq">{c.footer.faq}</Link></li>
                <li><Link className={linkClass} to="/contact">{c.footer.contact}</Link></li>
                <li><Link className={linkClass} to="/login">{c.footer.login}</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-brand-charcoal">
                {c.footer.legal}
              </p>
              <ul className="mt-4 space-y-3">
                <li><Link className={linkClass} to="/privacy">{c.footer.privacy}</Link></li>
                <li><Link className={linkClass} to="/terms">{c.footer.terms}</Link></li>
              </ul>
              <div className="mt-5 rounded-2xl border border-brand-line bg-white p-3">
                <p className="flex items-start gap-2 text-[0.68rem] leading-5 text-brand-muted">
                  <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-dark" aria-hidden="true" />
                  {c.footer.legalReview}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-brand-line pt-6 text-xs text-brand-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteConfig.name}. {c.footer.rights}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <p className="max-w-xl leading-5">{c.footer.contactPending}</p>
            <Link to="/contact" className="inline-flex items-center gap-1 font-semibold text-brand-dark">
              {c.footer.contact}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

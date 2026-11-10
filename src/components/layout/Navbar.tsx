import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  Download,
  LayoutDashboard,
  LogOut,
  Smartphone,
  Store,
  X,
} from 'lucide-react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../lib/auth'
import { siteConfig } from '../../lib/config'
import { cn, initials } from '../../lib/utils'
import { ButtonLink } from '../ui/Button'

function TanzaniaFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 20"
      className={cn('h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10', className)}
      aria-hidden="true"
    >
      <rect width="30" height="20" fill="#1EB53A" />
      <path d="M30 0v20H0z" fill="#00A3DD" />
      <path d="M-2 20 32 0" stroke="#FCD116" strokeWidth="8" />
      <path d="M-2 20 32 0" stroke="#000000" strokeWidth="3.6" />
    </svg>
  )
}

function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, c } = useI18n()
  const nextLang = lang === 'en' ? 'sw' : 'en'
  const label = `${c.language.switch}: ${c.language[nextLang]}`

  return (
    <motion.button
      type="button"
      onClick={() => setLang(nextLang)}
      aria-label={label}
      title={label}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-brand-line bg-white font-bold uppercase tracking-[0.08em] text-brand-charcoal shadow-sm transition hover:border-brand-charcoal/20 hover:bg-brand-cream',
        compact ? 'h-9 px-2.5 text-[0.62rem]' : 'h-9 px-3 text-[0.66rem]',
      )}
    >
      <TanzaniaFlag />
      <motion.span
        key={lang}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        {lang}
      </motion.span>
    </motion.button>
  )
}

function AppMenuCard({ onNavigate }: { onNavigate: () => void }) {
  const { c } = useI18n()
  const className =
    'group mt-6 flex max-w-sm items-center gap-3 rounded-[1.35rem] border border-white/70 bg-white/55 p-3.5 shadow-[0_20px_50px_-30px_rgba(23,22,20,0.45)] backdrop-blur-xl transition hover:bg-white/80'

  const content = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-charcoal text-brand-orange">
        <Smartphone className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-brand-charcoal">{c.nav.getTheApp}</span>
        <span className="mt-0.5 block text-[0.65rem] text-brand-muted">
          {c.appDownload.installTag}
        </span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-brand-muted transition group-hover:translate-x-0.5 group-hover:text-brand-dark"
        aria-hidden="true"
      />
    </>
  )

  if (siteConfig.app.apkUrl) {
    return (
      <a href={siteConfig.app.apkUrl} download onClick={onNavigate} className={className}>
        {content}
      </a>
    )
  }

  return (
    <Link to="/#get-the-app" onClick={onNavigate} className={className}>
      {content}
    </Link>
  )
}

const primaryLinks = [
  { to: '/', key: 'home' as const, end: true },
  { to: '/about', key: 'about' as const },
  { to: '/services', key: 'services' as const },
  { to: '/how-it-works', key: 'howItWorks' as const },
  { to: '/faq', key: 'faq' as const },
  { to: '/contact', key: 'contact' as const },
]

const menuGroups = [
  {
    key: 'explore' as const,
    links: primaryLinks,
  },
  {
    key: 'partners' as const,
    links: [
      { to: '/vendors', key: 'vendors' as const },
      { to: '/riders', key: 'riders' as const },
      { to: '/register/vendor', key: 'vendorRegister' as const },
      { to: '/register/rider', key: 'riderRegister' as const },
      { to: '/application-status', key: 'status' as const },
    ],
  },
]

const footerLinkKeys = {
  faq: 'faq',
  vendors: 'vendor',
  riders: 'rider',
} as const

function menuLabel(
  c: ReturnType<typeof useI18n>['c'],
  groupKey: (typeof menuGroups)[number]['key'],
  linkKey: string,
) {
  if (groupKey === 'explore') {
    if (linkKey in c.nav) return c.nav[linkKey as keyof typeof c.nav]
    return c.footer[footerLinkKeys[linkKey as keyof typeof footerLinkKeys]]
  }
  if (linkKey === 'vendors') return c.footer.vendor
  if (linkKey === 'riders') return c.footer.rider
  return c.nav[linkKey as keyof typeof c.nav]
}

const listVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.045, delayChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: 18 },
  show: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const } },
}

export function Navbar() {
  const { c } = useI18n()
  const { user, isAuthenticated, isStaff, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const userRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    setMenuOpen(false)
    setUserOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setUserOpen(false)
      }
    }
    const onClick = (event: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(event.target as Node)) setUserOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-[60] border-b border-brand-line/80 bg-brand-cream/92 backdrop-blur-xl">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-brand-charcoal focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {c.labels.skipToContent}
      </a>
      <div className="container-page flex h-[74px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-5">
          <Link
            to="/"
            aria-label={c.labels.agizaHome}
            className="group inline-flex shrink-0 items-center rounded-full"
          >
            <motion.span
              whileHover={{ y: -1 }}
              className="font-display text-[1.7rem] font-extrabold leading-none tracking-[-0.065em] text-brand-charcoal transition-colors group-hover:text-brand-dark sm:text-[1.9rem]"
            >
              agiza
            </motion.span>
          </Link>

          <span className="hidden h-5 w-px bg-brand-line sm:block" aria-hidden="true" />

          <LanguageSwitcher compact />
        </div>

        <div className="flex items-center gap-2">
          <a
            href={siteConfig.analyticsUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden h-10 items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 text-xs font-bold text-brand-charcoal shadow-sm transition hover:border-brand-charcoal/25 hover:bg-brand-cream md:inline-flex"
          >
            <BarChart3 className="h-3.5 w-3.5 text-brand-dark" aria-hidden="true" />
            {c.nav.analytics}
          </a>
          {siteConfig.app.apkUrl ? (
            <a
              href={siteConfig.app.apkUrl}
              download
              className="hidden h-10 items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 text-xs font-bold text-brand-charcoal shadow-sm transition hover:border-brand-charcoal/25 hover:bg-brand-cream md:inline-flex"
            >
              <Download className="h-3.5 w-3.5 text-brand-dark" aria-hidden="true" />
              {c.nav.installApp}
            </a>
          ) : null}
          {isAuthenticated && user ? (
            <div className="relative" ref={userRef}>
              <button
                type="button"
                onClick={() => setUserOpen((open) => !open)}
                aria-expanded={userOpen}
                aria-haspopup="menu"
                aria-label={c.nav.account}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-brand-line bg-white py-1.5 pl-1.5 pr-2.5 text-xs font-bold text-brand-charcoal shadow-sm transition hover:border-brand-charcoal/25 sm:pr-3"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-charcoal text-[0.62rem] font-bold text-white">
                  {initials(user.username || user.phone || 'A')}
                </span>
                <span className="hidden max-w-24 truncate sm:block">
                  {user.username?.replace('+255', '0') || c.nav.account}
                </span>
                <ChevronDown className="hidden h-3 w-3 text-brand-muted sm:block" aria-hidden="true" />
              </button>
              <AnimatePresence>
                {userOpen ? (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="absolute right-0 top-[calc(100%+10px)] w-60 rounded-3xl border border-brand-line bg-white p-2 shadow-soft"
                  >
                    <div className="border-b border-brand-line px-3 pb-3 pt-2">
                      <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
                        {c.nav.signedInAs}
                      </p>
                      <p className="mt-1 truncate text-sm font-bold text-brand-charcoal">{user.username}</p>
                    </div>
                    <Link
                      to="/application-status"
                      role="menuitem"
                      className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-charcoal transition hover:bg-brand-cream"
                    >
                      <ClipboardCheck className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                      {c.nav.status}
                    </Link>
                    {isStaff ? (
                      <Link
                        to="/admin"
                        role="menuitem"
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-charcoal transition hover:bg-brand-cream"
                      >
                        <LayoutDashboard className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                        {c.nav.admin}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        logout()
                        navigate('/')
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-brand-error transition hover:bg-brand-error/5"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      {c.nav.logout}
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : (
            <ButtonLink to="/login" size="sm" className="whitespace-nowrap px-3.5 sm:px-4">
              {c.nav.login}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </ButtonLink>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? c.nav.close : c.nav.menu}
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-brand-line bg-white text-brand-charcoal shadow-sm transition hover:border-brand-charcoal/25 hover:bg-brand-cream"
          >
            <span className="relative block h-4 w-5" aria-hidden="true">
              <motion.span
                animate={menuOpen ? { rotate: 45, y: 7, width: 20 } : { rotate: 0, y: 0, width: 14 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute left-0 top-0 h-[2px] rounded-full bg-brand-charcoal"
              />
              <motion.span
                animate={menuOpen ? { opacity: 0, x: 4 } : { opacity: 1, x: 0, width: 20 }}
                transition={{ duration: 0.18 }}
                className="absolute left-0 top-[7px] h-[2px] rounded-full bg-brand-charcoal"
              />
              <motion.span
                animate={menuOpen ? { rotate: -45, y: -7, width: 20 } : { rotate: 0, y: 0, width: 16 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute left-0 top-[14px] h-[2px] rounded-full bg-brand-charcoal"
              />
            </span>
          </button>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              key="site-menu"
            id="site-menu"
            role="dialog"
            aria-modal="true"
            aria-label={c.nav.menu}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-[70] overflow-y-auto bg-brand-cream/90 text-brand-charcoal backdrop-blur-2xl"
          >
            <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
              <motion.div
                animate={
                  reduceMotion
                    ? undefined
                    : { x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.12, 1] }
                }
                transition={
                  reduceMotion
                    ? undefined
                    : { duration: 16, repeat: Infinity, ease: 'easeInOut' }
                }
                className="absolute -left-40 -top-44 h-[34rem] w-[34rem] rounded-full bg-brand-orange/25 blur-[120px]"
              />
              <motion.div
                animate={
                  reduceMotion
                    ? undefined
                    : { x: [0, -40, 0], y: [0, -24, 0], scale: [1.08, 1, 1.08] }
                }
                transition={
                  reduceMotion
                    ? undefined
                    : { duration: 19, repeat: Infinity, ease: 'easeInOut' }
                }
                className="absolute -bottom-52 -right-40 h-[36rem] w-[36rem] rounded-full bg-brand-dark/20 blur-[130px]"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.72), transparent 34%), radial-gradient(circle at 82% 76%, rgba(244,119,33,0.16), transparent 42%)',
                }}
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12"
            >
              <div className="flex items-center justify-between gap-4">
                <Link
                  to="/"
                  onClick={() => setMenuOpen(false)}
                  aria-label={c.labels.agizaHome}
                  className="font-display text-[1.9rem] font-extrabold leading-none tracking-[-0.065em] text-brand-charcoal transition hover:text-brand-dark sm:text-[2.2rem]"
                >
                  agiza
                </Link>
                <div className="flex items-center gap-2.5">
                  <LanguageSwitcher compact />
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    aria-label={c.nav.close}
                    className="grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-white/65 text-brand-charcoal shadow-sm backdrop-blur-xl transition hover:bg-white"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-8 grid flex-1 items-start gap-8 lg:mt-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-16">
                <div className="max-w-lg">
                  <p className="text-[0.64rem] font-bold uppercase tracking-[0.22em] text-brand-dark">
                    {c.nav.menu}
                  </p>
                  <h2 className="mt-3 font-display text-[2.25rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[3rem]">
                    {c.footer.tagline}
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-7 text-brand-muted">{c.footer.description}</p>

                  <AppMenuCard onNavigate={() => setMenuOpen(false)} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                  {menuGroups.map((group, groupIndex) => (
                    <motion.div
                      key={group.key}
                      variants={listVariants}
                      initial="hidden"
                      animate="show"
                      className="rounded-[1.75rem] border border-white/70 bg-white/55 p-5 shadow-[0_24px_60px_-38px_rgba(23,22,20,0.42)] backdrop-blur-2xl sm:p-6"
                    >
                      <p className="flex items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-brand-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden="true" />
                        {group.key === 'explore' ? c.footer.explore : c.footer.partners}
                      </p>
                      <motion.nav
                        aria-label={group.key === 'explore' ? c.labels.primaryNav : c.nav.becomePartner}
                        className="mt-2"
                        variants={listVariants}
                      >
                        {group.links.map((link, linkIndex) => (
                          <motion.div key={link.to} variants={itemVariants}>
                            <NavLink
                              to={link.to}
                              end={'end' in link ? link.end : false}
                              onClick={() => setMenuOpen(false)}
                              className={({ isActive }) =>
                                cn(
                                  'group flex items-center justify-between gap-4 border-b border-brand-charcoal/10 py-3 transition-colors last:border-b-0',
                                  isActive ? 'text-brand-dark' : 'text-brand-charcoal/75 hover:text-brand-charcoal',
                                )
                              }
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <span className="text-[0.56rem] font-bold uppercase tracking-[0.16em] text-brand-charcoal/25 transition group-hover:text-brand-orange">
                                  {String((groupIndex === 0 ? 0 : primaryLinks.length) + linkIndex + 1).padStart(2, '0')}
                                </span>
                                <span className="truncate text-[0.98rem] font-semibold">
                                  {menuLabel(c, group.key, link.key)}
                                </span>
                              </span>
                              <ArrowRight
                                className="h-4 w-4 shrink-0 -translate-x-1 opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-60"
                                aria-hidden="true"
                              />
                            </NavLink>
                          </motion.div>
                        ))}
                      </motion.nav>
                    </motion.div>
                  ))}
                </div>
              </div>

              <a
                href={siteConfig.analyticsUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
                className="mt-4 flex items-center justify-between gap-4 rounded-[1.35rem] border border-white/70 bg-white/55 p-4 shadow-[0_24px_60px_-38px_rgba(23,22,20,0.42)] backdrop-blur-2xl transition hover:bg-white/80 sm:p-5"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-charcoal text-brand-orange">
                    <BarChart3 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[0.62rem] font-bold uppercase tracking-[0.2em] text-brand-muted">
                      {c.footer.partners}
                    </span>
                    <span className="mt-0.5 block text-[0.98rem] font-semibold text-brand-charcoal">
                      {c.nav.analytics}
                    </span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-brand-muted" aria-hidden="true" />
              </a>

              <div className="mt-8 flex items-center justify-between gap-4 border-t border-brand-charcoal/10 pt-5 text-xs text-brand-muted">
                <span className="flex items-center gap-2">
                  <Store className="h-3.5 w-3.5" aria-hidden="true" />
                  {c.footer.tagline}
                </span>
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]">
                  {c.appDownload.androidApk}
                </span>
              </div>
            </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </header>
  )
}

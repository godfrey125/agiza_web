import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Download, Utensils, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useCopy } from '../../i18n'
import { siteConfig } from '../../lib/config'

const DISMISS_KEY = 'agiza.web.appPromptDismissed'

function MiniPhoneMockup() {
  return (
    <div className="relative h-[92px] w-[50px] shrink-0 rounded-[0.9rem] bg-brand-charcoal p-[3px] shadow-[0_12px_24px_-10px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
      <div className="relative h-full overflow-hidden rounded-[0.7rem] bg-[#FAF7F2]">
        <div className="flex items-center justify-between px-1.5 pb-0.5 pt-1 text-[0.26rem] font-bold text-brand-charcoal">
          <span>9:41</span>
          <span className="h-0.5 w-2.5 rounded-full bg-brand-charcoal/70" />
        </div>
        <div className="px-1.5">
          <div className="flex items-center gap-1">
            <img src="/agiza.png" alt="" className="h-3 w-3 rounded-[3px] object-cover" />
            <span className="text-[0.34rem] font-extrabold tracking-[-0.04em] text-brand-charcoal">agiza</span>
          </div>
          <div className="mt-1 h-6 rounded-md bg-brand-orange/15 p-1">
            <div className="h-2.5 w-full rounded-[2px] bg-brand-orange/35" />
            <div className="mt-1 h-1 w-3/4 rounded-full bg-brand-charcoal/15" />
          </div>
          <div className="mt-1 space-y-0.5">
            {[0, 1].map((item) => (
              <div key={item} className="flex items-center gap-1 rounded-[3px] bg-white p-0.5 ring-1 ring-black/5">
                <span className="grid h-2.5 w-2.5 place-items-center rounded-[2px] bg-brand-orange/15 text-brand-dark">
                  <Utensils className="h-1.5 w-1.5" aria-hidden="true" />
                </span>
                <span className="h-0.5 flex-1 rounded-full bg-brand-charcoal/15" />
              </div>
            ))}
          </div>
        </div>
        <span className="absolute bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-brand-charcoal/50" aria-hidden="true" />
      </div>
    </div>
  )
}

export function AppInstallPrompt() {
  const c = useCopy()
  const { pathname } = useLocation()
  const reduceMotion = useReducedMotion()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return

    const timer = window.setTimeout(() => setVisible(true), 2600)
    return () => window.clearTimeout(timer)
  }, [pathname])

  const dismiss = () => {
    setVisible(false)
    sessionStorage.setItem(DISMISS_KEY, '1')
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={
            reduceMotion
              ? { duration: 0.18 }
              : { type: 'spring', stiffness: 280, damping: 26, mass: 0.9 }
          }
          className="fixed bottom-4 left-4 right-4 z-[45] sm:left-auto sm:w-[390px]"
        >
          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
            transition={reduceMotion ? undefined : { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            className="relative overflow-hidden rounded-[1.6rem] border border-brand-line bg-white p-4 shadow-[0_26px_70px_-24px_rgba(23,22,20,0.45)]"
          >
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-brand-orange/15 blur-2xl"
              aria-hidden="true"
            />

            <button
              type="button"
              onClick={dismiss}
              aria-label={c.appDownload.installDismiss}
              className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full text-brand-muted transition hover:bg-brand-cream hover:text-brand-charcoal"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <div className="relative flex items-center gap-3.5 pr-6">
              <MiniPhoneMockup />

              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange/10 px-2 py-1 text-[0.56rem] font-bold uppercase tracking-[0.14em] text-brand-dark">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-orange opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-orange" />
                  </span>
                  {c.appDownload.installTag}
                </span>
                <p className="mt-2 font-display text-base font-extrabold leading-tight tracking-[-0.03em] text-brand-charcoal">
                  {c.appDownload.installTitle}
                </p>
                <p className="mt-1 text-[0.7rem] leading-5 text-brand-muted">
                  {c.appDownload.installBody}
                </p>
              </div>
            </div>

            <div className="relative mt-3 flex items-center justify-between gap-3 border-t border-brand-line pt-3">
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                {c.appDownload.androidApk}
              </span>
              {siteConfig.app.apkUrl ? (
                <a
                  href={siteConfig.app.apkUrl}
                  download
                  onClick={dismiss}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-charcoal px-3.5 py-2 text-[0.66rem] font-bold text-white transition hover:bg-black"
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  {c.appDownload.installCta}
                </a>
              ) : (
                <Link
                  to="/#get-the-app"
                  onClick={dismiss}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-charcoal px-3.5 py-2 text-[0.66rem] font-bold text-white transition hover:bg-black"
                >
                  {c.appDownload.installCta}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

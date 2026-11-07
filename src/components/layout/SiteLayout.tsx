import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { AppInstallPrompt } from '../home/AppInstallPrompt'
import { useCopy } from '../../i18n'

export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      if (target) {
        window.setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash])
  return null
}

function PageFallback() {
  const c = useCopy()
  return (
    <div className="container-page flex min-h-[55vh] items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <span
          className="h-9 w-9 animate-spin rounded-full border-2 border-brand-orange border-r-transparent"
          aria-hidden="true"
        />
        <p className="text-xs font-semibold text-brand-muted">{c.common.loading}</p>
      </div>
    </div>
  )
}

export function SiteLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-brand-cream">
      <Navbar />
      <main id="main-content" className="flex-1">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <AppInstallPrompt />
      <Footer />
    </div>
  )
}

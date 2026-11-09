import { Suspense } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { Logo } from '../ui/Logo'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../i18n'
import { adminCopy } from '../../i18n/admin'
import { cn } from '../../lib/utils'

function NavItem({
  to,
  end,
  icon: Icon,
  label,
  compact = false,
}: {
  to: string
  end?: boolean
  icon: LucideIcon
  label: string
  compact?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center gap-2.5 rounded-2xl font-semibold transition',
          compact ? 'shrink-0 px-3 py-2 text-xs' : 'px-3.5 py-3 text-sm',
          isActive
            ? 'bg-brand-charcoal text-white'
            : 'text-brand-muted hover:bg-white hover:text-brand-charcoal',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </NavLink>
  )
}

function AdminFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8" role="status">
      <span
        className="h-9 w-9 animate-spin rounded-full border-2 border-brand-orange border-r-transparent"
        aria-hidden="true"
      />
      <span className="sr-only">Loading dashboard</span>
    </div>
  )
}

export function AdminLayout() {
  const { lang } = useI18n()
  const d = adminCopy[lang]
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-brand-cream lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden border-r border-brand-line bg-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="px-5 py-6">
          <Logo />
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-cream px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-brand-dark ring-1 ring-inset ring-brand-line">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {d.layout.console}
          </div>
        </div>

        <nav aria-label={d.layout.nav} className="flex-1 space-y-1 px-3 py-2">
          <NavItem to="/admin" end icon={LayoutDashboard} label={d.layout.overview} />
          <NavItem
            to="/admin/applications"
            icon={ClipboardCheck}
            label={d.layout.applications}
          />
          <NavItem to="/" icon={ExternalLink} label={d.layout.viewSite} />
        </nav>

        <div className="border-t border-brand-line p-4">
          <p className="px-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
            {d.layout.signedIn}
          </p>
          <p className="mt-1 truncate px-1 text-sm font-semibold text-brand-charcoal">
            {user?.phone || user?.username || d.page.guests}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 inline-flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-brand-muted transition hover:bg-brand-cream hover:text-brand-charcoal"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {d.layout.logout}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-brand-line bg-brand-cream/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Logo />
            <div className="flex items-center gap-1">
              <Link
                to="/"
                className="grid h-10 w-10 place-items-center rounded-full text-brand-muted transition hover:bg-white hover:text-brand-charcoal"
                aria-label={d.layout.viewSite}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="grid h-10 w-10 place-items-center rounded-full text-brand-muted transition hover:bg-white hover:text-brand-charcoal"
                aria-label={d.layout.logout}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <nav
            aria-label={d.layout.nav}
            className="mt-3 flex gap-1.5 overflow-x-auto pb-1"
          >
            <NavItem to="/admin" end icon={LayoutDashboard} label={d.layout.overview} compact />
            <NavItem
              to="/admin/applications"
              icon={ClipboardCheck}
              label={d.layout.applications}
              compact
            />
          </nav>
        </header>

        <main id="main-content" className="min-w-0 flex-1">
          <Suspense fallback={<AdminFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

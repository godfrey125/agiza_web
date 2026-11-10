import { Suspense } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Logo } from '../ui/Logo'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../i18n'
import { controlCopy } from '../../i18n/control'
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
          'inline-flex items-center gap-2.5 rounded-xl font-semibold transition',
          compact ? 'shrink-0 px-3 py-2 text-xs' : 'px-3 py-2.5 text-[0.82rem]',
          isActive
            ? 'bg-brand-orange text-white shadow-[0_10px_30px_-16px_rgba(244,119,33,0.9)]'
            : 'text-white/60 hover:bg-white/10 hover:text-white',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </NavLink>
  )
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-[0.58rem] font-bold uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      {children}
    </div>
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
  const d = controlCopy[lang]
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const roleLabel = user?.staff_role ? d.staffRoles[user.staff_role] : d.staffRoles.NONE

  return (
    <div className="min-h-dvh bg-brand-cream lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="hidden bg-brand-charcoal lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="px-5 py-6">
          <Logo dark />
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-white/70 ring-1 ring-inset ring-white/10">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-orange" aria-hidden="true" />
            {d.nav.console}
          </div>
        </div>

        <nav aria-label={d.nav.nav} className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          <NavGroup label={d.nav.workspace}>
            <NavItem to="/admin" end icon={LayoutDashboard} label={d.nav.overview} />
            <NavItem to="/admin/users" icon={Users} label={d.nav.users} />
            <NavItem to="/admin/trust" icon={ShieldAlert} label={d.nav.trust} />
          </NavGroup>

          <NavGroup label={d.nav.system}>
            <NavItem to="/admin/applications" icon={ClipboardCheck} label={d.nav.applications} />
            <NavItem to="/admin/audit" icon={ScrollText} label={d.nav.audit} />
            <NavItem to="/admin/staff" icon={UserCog} label={d.nav.staff} />
            <NavItem to="/" icon={ExternalLink} label={d.nav.viewSite} />
          </NavGroup>
        </nav>

        <div className="border-t border-white/10 p-4">
          <p className="px-1 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-white/40">
            {d.nav.signedIn}
          </p>
          <p className="mt-1 truncate px-1 text-sm font-semibold text-white">
            {user?.phone || user?.username}
          </p>
          <p className="mt-0.5 truncate px-1 text-[0.65rem] text-brand-orange">{roleLabel}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {d.nav.logout}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-brand-line bg-brand-charcoal px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Logo dark />
            <div className="flex items-center gap-1">
              <Link
                to="/"
                className="grid h-10 w-10 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label={d.nav.viewSite}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="grid h-10 w-10 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label={d.nav.logout}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <nav
            aria-label={d.nav.nav}
            className="mt-3 flex gap-1.5 overflow-x-auto pb-1"
          >
            <NavItem to="/admin" end icon={LayoutDashboard} label={d.nav.overview} compact />
            <NavItem to="/admin/users" icon={Users} label={d.nav.users} compact />
            <NavItem to="/admin/trust" icon={ShieldAlert} label={d.nav.trust} compact />
            <NavItem to="/admin/applications" icon={ClipboardCheck} label={d.nav.applications} compact />
            <NavItem to="/admin/audit" icon={ScrollText} label={d.nav.audit} compact />
            <NavItem to="/admin/staff" icon={UserCog} label={d.nav.staff} compact />
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

import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  ArrowLeft,
  Bike,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Receipt,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Store,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import { useMarketplaceAuth } from '../../lib/marketplace-auth'
import { cn } from '../../lib/format'

const tabs = [
  { label: 'Overview', to: '/marketplace', icon: LayoutDashboard, end: true },
  { label: 'Orders', to: '/marketplace/orders', icon: Receipt, permission: 'orders.view' },
  { label: 'Riders & deliveries', to: '/marketplace/riders', icon: Bike, permission: 'orders.view' },
  {
    label: 'Vendors & food',
    to: '/marketplace/vendors',
    icon: Store,
    permission: ['users.view', 'reports.view', 'content.view'],
  },
  {
    label: 'Payments',
    to: '/marketplace/payments',
    icon: Wallet,
    permission: ['finance.view', 'orders.view'],
  },
  {
    label: 'Applications',
    to: '/marketplace/applications',
    icon: ClipboardCheck,
    permission: 'applications.view',
  },
  { label: 'Users', to: '/marketplace/users', icon: Users, permission: 'users.view' },
  {
    label: 'Trust & safety',
    to: '/marketplace/trust',
    icon: ShieldAlert,
    permission: ['appeals.view', 'risk.view', 'users.view'],
  },
  { label: 'Audit log', to: '/marketplace/audit', icon: ScrollText, permission: 'audit.view' },
  { label: 'Staff & roles', to: '/marketplace/staff', icon: UserCog, permission: 'users.view' },
]

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  OPERATIONS_MANAGER: 'Operations manager',
  VERIFICATION_OFFICER: 'Verification officer',
  FINANCE_OFFICER: 'Finance officer',
  CUSTOMER_SUPPORT: 'Customer support',
  TRUST_SAFETY_OFFICER: 'Trust & safety officer',
  CONTENT_MANAGER: 'Content manager',
  NONE: 'No staff role',
}

export function MarketplaceLayout() {
  const { admin, signOut, hasPermission } = useMarketplaceAuth()
  const visibleTabs = tabs.filter((tab) => hasPermission(tab.permission))

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto w-full max-w-[1500px] px-3 py-5 sm:px-5 lg:px-7 lg:py-6">
        <header className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-soft">
              <ShieldCheck size={19} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-base font-extrabold leading-5 tracking-[-0.03em] text-ink">
                Agiza Admin
              </p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                Platform control center
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 hidden text-right sm:block">
              <p className="max-w-[230px] truncate text-xs font-semibold text-ink">
                {admin?.email || admin?.username}
              </p>
              <p className="text-[10px] text-muted">
                {roleLabels[admin?.staff_role || 'NONE'] || admin?.staff_role}
              </p>
            </div>
            <Link to="/dashboard" className="btn-secondary btn-sm">
              <ArrowLeft size={13} />
              Restaurant workspace
            </Link>
            <button type="button" onClick={signOut} className="btn-ghost btn-sm text-coral">
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </header>

        <nav className="hide-scrollbar mb-5 flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 shadow-soft">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted hover:bg-[#fbf7f1] hover:text-ink',
                  )
                }
              >
                <Icon size={14} />
                {tab.label}
              </NavLink>
            )
          })}
        </nav>

        <Outlet />
      </div>
    </div>
  )
}

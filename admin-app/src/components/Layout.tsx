import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, Bell, Boxes, ChevronDown, Command, FileText, LayoutDashboard, LogOut,
  Megaphone, Menu, Receipt, Search, Settings, ShieldAlert, ShieldCheck, Star, Tags, Users,
  UtensilsCrossed, X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useMarketplaceAuth } from '../lib/marketplace-auth'
import { api, assetUrl } from '../lib/api'
import { agizaLinks } from '../lib/links'
import type { NotificationItem } from '../lib/types'
import { cn, timeAgo } from '../lib/format'
import { Avatar, StatusBadge } from './ui'

const workspaceNav = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { label: 'Menu Items', to: '/menu', icon: UtensilsCrossed, permission: 'menu.view' },
  { label: 'Categories', to: '/categories', icon: Tags, permission: 'categories.view' },
  { label: 'Orders', to: '/orders', icon: Receipt, permission: 'orders.view' },
  { label: 'Customers', to: '/customers', icon: Users, permission: 'customers.view' },
  { label: 'Inventory', to: '/inventory', icon: Boxes, permission: 'inventory.view' },
  { label: 'Analytics', to: '/analytics', icon: BarChart3, permission: 'analytics.view' },
  { label: 'Reports', to: '/reports', icon: FileText, permission: 'reports.view' },
  { label: 'Marketing', to: '/marketing', icon: Megaphone, permission: 'marketing.view' },
  { label: 'Reviews', to: '/reviews', icon: Star, permission: 'reviews.view' },
]

const systemNav = [
  { label: 'Settings', to: '/settings', icon: Settings, permission: 'settings.view' },
]

const marketplaceNav = [
  { label: 'Admin console', to: '/marketplace', icon: ShieldAlert },
]

function useClickOutside(ref: React.RefObject<HTMLElement | null>, callback: () => void) {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) callback()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, callback])
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', compact && 'justify-center')}>
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-primary text-white shadow-soft">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5.2 19 11 5h2l5.8 14h-2.6l-1.4-3.6H9.2L7.8 19H5.2Zm4.8-5.7h4L12 8.1l-2 5.2Z" fill="currentColor" />
          <circle cx="18.4" cy="18" r="2.1" fill="currentColor" opacity=".72" />
        </svg>
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="font-display text-[17px] font-extrabold leading-5 tracking-[-0.03em] text-ink">Agiza Admin</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted">Platform control center</p>
        </div>
      )}
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, hasPermission } = useAuth()
  const visibleWorkspace = workspaceNav.filter((item) => hasPermission(item.permission))
  const visibleSystem = systemNav.filter((item) => hasPermission(item.permission))
  const canOpenMarketplace = (user?.role?.permissions || []).includes('*')

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-[84px] shrink-0 items-center border-b border-line px-6">
        <Link to="/dashboard" onClick={onNavigate} aria-label="Agiza Admin home"><Logo /></Link>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {canOpenMarketplace ? (
          <>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#a39b91]">Platform</p>
            <nav className="space-y-1">
              {marketplaceNav.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link-active')}
                  >
                    <Icon size={17} strokeWidth={2} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>
          </>
        ) : null}
        <p className={cn('mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#a39b91]', canOpenMarketplace && 'mt-7')}>Restaurant workspace</p>
        <nav className="space-y-1">
          {visibleWorkspace.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link-active')}
              >
                <Icon size={17} strokeWidth={2} />
                <span className="truncate">{item.label}</span>
                {item.label === 'Orders' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </NavLink>
            )
          })}
        </nav>
        <p className="mb-2 mt-7 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#a39b91]">System</p>
        <nav className="space-y-1">
          {visibleSystem.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} onClick={onNavigate} className={({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link-active')}>
                <Icon size={17} strokeWidth={2} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
      <div className="shrink-0 border-t border-line p-4">
        <div className="rounded-2xl bg-[linear-gradient(135deg,#FFF0E8,#FAF7F2)] p-3.5">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck size={16} />
            <p className="text-xs font-bold">Protected workspace</p>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted">Your role is enforced by the server on every request.</p>
          <div className="mt-3 flex items-center gap-2">
            <Avatar src={user?.avatarUrl} name={user?.name} size={28} />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-[10px] text-muted">{user?.role.name}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between px-1 text-[10px] text-muted">
          <a href={agizaLinks.website} target="_blank" rel="noreferrer" className="font-semibold transition hover:text-primary">Agiza website</a>
          <a href={agizaLinks.apk} className="font-semibold transition hover:text-primary">Get the app</a>
        </div>
      </div>
    </div>
  )
}

function SearchPanel({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<number | null>(null)

  useClickOutside(wrapperRef, () => setOpen(false))

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    if (timer.current) window.clearTimeout(timer.current)
    setLoading(true)
    timer.current = window.setTimeout(async () => {
      try {
        const data = await api.get<{ results: any[] }>(`/api/search?q=${encodeURIComponent(query)}`)
        setResults(data.results)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [query])

  const go = (path: string) => {
    setOpen(false)
    setQuery('')
    navigate(path)
    onNavigate?.()
  }

  return (
    <div ref={wrapperRef} className={mobile ? 'relative w-full' : 'relative hidden w-full max-w-[390px] md:block'}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9f978c]" />
      <input
        ref={inputRef}
        value={query}
        autoFocus={mobile}
        onChange={(event) => { setQuery(event.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search orders, dishes, guests…"
        className="h-10 w-full rounded-xl border border-line bg-white/80 pl-10 pr-16 text-sm text-ink outline-none transition placeholder:text-[#a59d93] focus:border-primary/60 focus:bg-white focus:ring-4 focus:ring-primary/10"
        aria-label="Global search"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-line bg-[#fbf8f3] px-1.5 py-0.5 text-[10px] font-semibold text-muted lg:flex">
        <Command size={9} /> K
      </span>
      {open && (query.trim().length >= 2 || results.length > 0) && (
        <div className="absolute left-0 right-0 top-[46px] z-50 overflow-hidden rounded-2xl border border-line bg-white shadow-float animate-fade-in">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Search results</p>
            <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink"><X size={13} /></button>
          </div>
          <div className="max-h-[380px] overflow-y-auto p-2">
            {loading && <p className="px-3 py-5 text-center text-sm text-muted">Searching…</p>}
            {!loading && results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">No matches for “{query}”. Try a guest name or order number.</p>}
            {!loading && results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}-${index}`}
                type="button"
                onClick={() => go(result.path)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-[#fcf8f2]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-peach text-primary">
                  {result.imageUrl ? <img src={assetUrl(result.imageUrl)} alt="" className="h-full w-full object-cover" /> : <Search size={14} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{result.title}</span>
                    <span className="shrink-0 rounded-full bg-[#f4f0ea] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted">{result.type}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{result.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-line bg-[#fcfaf6] px-3 py-2 text-[10px] text-muted">Search across menu items, orders, guests and categories.</div>
        </div>
      )}
    </div>
  )
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ notifications: NotificationItem[]; unread: number }>('/api/notifications')
      setItems(data.notifications)
      setUnread(data.unread)
    } catch { /* the dashboard remains usable */ }
  }, [])

  useEffect(() => { load() }, [load])

  const markAll = async () => {
    await api.post('/api/notifications/read-all')
    setItems((current) => current.map((item) => ({ ...item, read: true })))
    setUnread(0)
  }

  const openItem = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await api.patch(`/api/notifications/${item.id}/read`)
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry))
        setUnread((current) => Math.max(0, current - 1))
      } catch { /* ignore */ }
    }
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="icon-btn relative" aria-label="Notifications">
        <Bell size={17} />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-coral px-1 text-[8px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[340px] overflow-hidden rounded-2xl border border-line bg-white shadow-float animate-fade-in sm:w-[390px]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="font-display text-sm font-bold text-ink">Notifications</p>
              <p className="text-[10px] text-muted">{unread ? `${unread} unread update${unread === 1 ? '' : 's'}` : 'You are all caught up'}</p>
            </div>
            <button type="button" onClick={markAll} className="text-[11px] font-semibold text-primary hover:underline">Mark all read</button>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-12 text-center text-sm text-muted">No notifications yet.</p>}
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => openItem(item)} className={cn('flex w-full gap-3 border-b border-[#f5f1eb] px-4 py-3 text-left transition last:border-0 hover:bg-[#fcf8f2]', !item.read && 'bg-[#fffcf8]')}>
                <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', item.read ? 'bg-[#e7e0d6]' : 'bg-primary')} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-ink">{item.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-5 text-muted">{item.message}</span>
                  <span className="mt-1 block text-[10px] font-medium text-[#a39b91]">{timeAgo(item.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileMenu() {
  const { user } = useAuth()
  const { signOut } = useMarketplaceAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  useClickOutside(ref, () => setOpen(false))

  const logout = async () => {
    signOut()
    navigate('/')
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 rounded-xl p-1 transition hover:bg-white/80" aria-label="Account menu">
        <Avatar src={user?.avatarUrl} name={user?.name} size={34} />
        <span className="hidden min-w-0 text-left xl:block">
          <span className="block max-w-[130px] truncate text-xs font-semibold text-ink">{user?.name}</span>
          <span className="block max-w-[130px] truncate text-[10px] text-muted">{user?.role.name}</span>
        </span>
        <ChevronDown size={14} className="hidden text-muted xl:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[240px] overflow-hidden rounded-2xl border border-line bg-white shadow-float animate-fade-in">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-bold text-ink">{user?.name}</p>
            <p className="mt-0.5 text-xs text-muted">{user?.email}</p>
            <StatusBadge status={user?.role.name || 'STAFF'} className="mt-2" />
          </div>
          <div className="p-2">
            <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#5f5a53] hover:bg-[#fcf8f2]"><Settings size={14} /> Settings</Link>
            <Link to="/settings?tab=security" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#5f5a53] hover:bg-[#fcf8f2]"><ShieldCheck size={14} /> Security</Link>
            <button type="button" onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-coral hover:bg-soft-red"><LogOut size={14} /> Sign out</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const [mobileNav, setMobileNav] = useState(false)
  const [mobileSearch, setMobileSearch] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileNav(false)
    setMobileSearch(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-cream">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-line lg:block">
        <Sidebar />
      </aside>
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={() => setMobileNav(false)} aria-label="Close navigation" />
          <div className="relative h-full w-[285px] animate-slide-in shadow-float">
            <button type="button" onClick={() => setMobileNav(false)} className="absolute right-3 top-6 z-10 icon-btn" aria-label="Close navigation"><X size={16} /></button>
            <Sidebar onNavigate={() => setMobileNav(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-line/80 topbar-blur">
          <div className="flex h-[68px] items-center gap-2 px-3 sm:px-5 lg:px-7">
            <button type="button" className="icon-btn lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={18} /></button>
            <div className="mr-1 hidden items-center gap-2 text-xs text-muted sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span>Live operations</span>
            </div>
            <SearchPanel />
            <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
              <button type="button" className="icon-btn md:hidden" onClick={() => setMobileSearch((value) => !value)} aria-label="Search"><Search size={17} /></button>
              <Link to="/settings" className="icon-btn hidden sm:inline-flex" aria-label="Settings"><Settings size={17} /></Link>
              <NotificationsMenu />
              <div className="mx-1 hidden h-7 w-px bg-line sm:block" />
              <ProfileMenu />
            </div>
          </div>
          {mobileSearch && (
            <div className="border-t border-line bg-white/90 px-3 py-2 md:hidden">
              <SearchPanel mobile onNavigate={() => setMobileSearch(false)} />
            </div>
          )}
        </header>
        <main className="page-enter min-h-[calc(100vh-68px)] px-3 py-5 sm:px-5 sm:py-6 lg:px-7 lg:py-7">
          <Outlet />
          <footer className="mt-10 flex flex-col gap-2 border-t border-line pt-4 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>Agiza Admin · Platform control center</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <a href={agizaLinks.website} target="_blank" rel="noreferrer" className="font-semibold transition hover:text-primary">Agiza website</a>
              <a href={agizaLinks.apk} className="font-semibold transition hover:text-primary">Download Agiza app</a>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Connected to live workspace data</span>
            </span>
          </footer>
        </main>
      </div>
    </div>
  )
}

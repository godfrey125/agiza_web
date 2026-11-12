import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, getToken } from './api'
import { marketplaceTokenStore } from './marketplace'
import type { User } from './types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  setUser: (user: User | null) => void
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)
const ADMIN_HOME = import.meta.env.BASE_URL || '/admin/'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await api.get<{ user: User }>('/auth/me')
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const unauthorized = () => setUser(null)
    window.addEventListener('agiza-admin:unauthorized', unauthorized)
    return () => window.removeEventListener('agiza-admin:unauthorized', unauthorized)
  }, [refresh])

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch { /* the local session is cleared regardless */ }
    marketplaceTokenStore.clear()
    setUser(null)
    window.location.replace(ADMIN_HOME)
  }, [])

  const hasPermission = useCallback((permission: string) => {
    const permissions = user?.role?.permissions || []
    return permissions.includes('*') || permissions.includes(permission)
  }, [user])

  const value = useMemo<AuthContextValue>(() => ({
    user, loading, signOut, refresh, setUser, hasPermission,
  }), [user, loading, signOut, refresh, hasPermission])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider.')
  return context
}

export function ProtectedRoute({ children, permission, anyOf }: { children: ReactNode; permission?: string; anyOf?: string[] }) {
  const { user, loading, hasPermission, signOut } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
          <p className="text-sm font-medium text-muted">Opening your workspace…</p>
        </div>
      </div>
    )
  }
  if (!user) {
    // The marketplace gate at /admin/ owns the single sign-in flow. If the
    // marketplace identity is valid but the restaurant profile is missing,
    // show a clear state instead of redirecting into a loop.
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="card max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-peach text-primary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3z" /><path d="M3 9h18M9 21V9" /></svg>
          </div>
          <h1 className="font-display text-xl font-bold">Restaurant workspace unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            You are signed in to Agiza Admin, but the restaurant profile for this account
            could not be loaded. The marketplace console is still available.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link to="/marketplace" className="btn-primary">Go to marketplace</Link>
            <button type="button" className="btn-secondary" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }
  const permitted = permission ? hasPermission(permission) : anyOf ? anyOf.some((item) => hasPermission(item)) : true
  if (!permitted) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="card max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-soft-red text-coral">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h1 className="font-display text-xl font-bold">Access restricted</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Your role does not include access to this module. Ask a Super Admin to review your permissions.</p>
          <Link to="/dashboard" className="btn-primary mt-5">Back to dashboard</Link>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

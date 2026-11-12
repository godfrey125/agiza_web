import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  fetchMyPermissions,
  isMarketplaceAdmin,
  marketplaceConfig,
  marketplaceFetchMe,
  marketplaceLogin,
  marketplaceTokenStore,
  type AuthTokens,
  type AuthUser,
} from './marketplace'
import { supabase } from './supabase'

interface MarketplaceAuthValue {
  admin: AuthUser | null
  permissions: string[]
  loading: boolean
  error: string
  signIn: (email: string, password: string) => Promise<void>
  signInWithSession: (tokens: AuthTokens, user: AuthUser) => Promise<void>
  signOut: () => void
  refresh: () => Promise<void>
  hasPermission: (required?: string | string[]) => boolean
}

const MarketplaceAuthContext = createContext<MarketplaceAuthValue | null>(null)

function permissionFallback(user: AuthUser) {
  return user.staff_role === 'SUPER_ADMIN' ? ['*'] : []
}

export function MarketplaceAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadPermissions = useCallback(async (user: AuthUser) => {
    try {
      const result = await fetchMyPermissions()
      setPermissions(result.permissions?.length ? result.permissions : permissionFallback(user))
    } catch {
      setPermissions(permissionFallback(user))
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!marketplaceTokenStore.access) {
      marketplaceTokenStore.clear()
      setAdmin(null)
      setPermissions([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await marketplaceFetchMe()
      if (!isMarketplaceAdmin(user)) {
        marketplaceTokenStore.clear()
        setAdmin(null)
        setPermissions([])
        setError(
          `This section is restricted to ${marketplaceConfig.adminEmail}. Sign in with that account.`,
        )
      } else {
        marketplaceTokenStore.saveUser(user)
        setAdmin(user)
        await loadPermissions(user)
      }
    } catch {
      marketplaceTokenStore.clear()
      setAdmin(null)
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }, [loadPermissions])

  useEffect(() => {
    void refresh()
    // The restaurant API shares the Django access token. When it reports 401,
    // try the normal refresh-token rotation before falling back to sign-in.
    const onUnauthorized = () => { void refresh() }
    window.addEventListener('agiza-admin:unauthorized', onUnauthorized)
    return () => window.removeEventListener('agiza-admin:unauthorized', onUnauthorized)
  }, [refresh])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError('')
      const response = await marketplaceLogin(email.trim(), password)
      if (!isMarketplaceAdmin(response.user)) {
        marketplaceTokenStore.clear()
        throw new Error(
          `Only ${marketplaceConfig.adminEmail} can open the platform admin panel.`,
        )
      }
      marketplaceTokenStore.save(response.tokens, response.user)
      setAdmin(response.user)
      await loadPermissions(response.user)
    },
    [loadPermissions],
  )

  const signInWithSession = useCallback(
    async (tokens: AuthTokens, user: AuthUser) => {
      setError('')
      if (!isMarketplaceAdmin(user)) {
        marketplaceTokenStore.clear()
        throw new Error(
          `Only ${marketplaceConfig.adminEmail} can open the platform admin panel.`,
        )
      }
      marketplaceTokenStore.save(tokens, user)
      setAdmin(user)
      await loadPermissions(user)
    },
    [loadPermissions],
  )

  const signOut = useCallback(() => {
    marketplaceTokenStore.clear()
    setAdmin(null)
    setPermissions([])
    setError('')
    // Clear the Supabase session as well so the next sign-in really asks
    // Google to choose an account instead of silently reusing the old one.
    void supabase?.auth.signOut()
  }, [])

  const hasPermission = useCallback(
    (required?: string | string[]) => {
      if (!required) return true
      if (permissions.includes('*')) return true
      const values = Array.isArray(required) ? required : [required]
      return values.some((value) => permissions.includes(value))
    },
    [permissions],
  )

  const value = useMemo<MarketplaceAuthValue>(
    () => ({
      admin,
      permissions,
      loading,
      error,
      signIn,
      signInWithSession,
      signOut,
      refresh,
      hasPermission,
    }),
    [admin, permissions, loading, error, signIn, signInWithSession, signOut, refresh, hasPermission],
  )

  return (
    <MarketplaceAuthContext.Provider value={value}>{children}</MarketplaceAuthContext.Provider>
  )
}

export function useMarketplaceAuth() {
  const context = useContext(MarketplaceAuthContext)
  if (!context) {
    throw new Error('useMarketplaceAuth must be used inside MarketplaceAuthProvider.')
  }
  return context
}

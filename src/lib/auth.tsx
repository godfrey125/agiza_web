import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  fetchMe,
  requestOtp,
  supabaseExchange,
  tokenStore,
  verifyOtp,
  type AuthUser,
} from '../lib/api'
import { supabase } from '../lib/supabase'
import { formatPhoneTZ } from '../lib/utils'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isStaff: boolean
  sendOtp: (phone: string) => Promise<{ devOtp?: string }>
  confirmOtp: (phone: string, otp: string) => Promise<AuthUser>
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  completeSupabaseSignIn: () => Promise<AuthUser>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => tokenStore.user)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null)
      return
    }
    try {
      const fresh = await fetchMe()
      tokenStore.saveUser(fresh)
      setUser(fresh)
    } catch {
      // Keep the cached user for transient network failures. A 401 already
      // clears tokens inside the API client's refresh flow.
      if (!tokenStore.access) setUser(null)
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (tokenStore.access) {
        await refreshUser()
      }
      if (active) setIsLoading(false)
    })()
    return () => {
      active = false
    }
  }, [refreshUser])

  const sendOtp = useCallback(async (phone: string) => {
    const normalised = formatPhoneTZ(phone)
    const response = await requestOtp(normalised)
    return { devOtp: response.dev_otp }
  }, [])

  const confirmOtp = useCallback(async (phone: string, otp: string) => {
    const normalised = formatPhoneTZ(phone)
    const response = await verifyOtp(normalised, otp)
    tokenStore.save(response.tokens, response.user)
    setUser(response.user)
    return response.user
  }, [])

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    if (!supabase) {
      throw new Error('Google sign-in is not configured yet.')
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) throw error
  }, [])

  /**
   * Runs on /auth/callback after Google returns. Supabase has already turned the
   * OAuth code into a session; we exchange its access token for an Agiza JWT so
   * every existing API call and role rule keeps working.
   */
  const completeSupabaseSignIn = useCallback(async () => {
    if (!supabase) {
      throw new Error('Google sign-in is not configured yet.')
    }

    const search = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const urlError = search.get('error') || hash.get('error')
    if (urlError) {
      const description =
        search.get('error_description') || hash.get('error_description') || urlError
      throw new Error(`Google sign-in was rejected (${description}).`)
    }

    // Supabase parses the OAuth response asynchronously when the callback page
    // mounts. Poll briefly instead of failing on the first render.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      const accessToken = data.session?.access_token
      if (accessToken) {
        const response = await supabaseExchange(accessToken)
        tokenStore.save(response.tokens, response.user)
        setUser(response.user)
        return response.user
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250))
    }

    throw new Error('Google sign-in did not return a session. Please try again.')
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    void supabase?.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      isStaff: user?.role === 'admin',
      sendOtp,
      confirmOtp,
      signInWithGoogle,
      completeSupabaseSignIn,
      logout,
      refreshUser,
    }),
    [
      user,
      isLoading,
      sendOtp,
      confirmOtp,
      signInWithGoogle,
      completeSupabaseSignIn,
      logout,
      refreshUser,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

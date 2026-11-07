import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  fetchMe,
  requestOtp,
  tokenStore,
  verifyOtp,
  type AuthUser,
} from '../lib/api'
import { formatPhoneTZ } from '../lib/utils'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isStaff: boolean
  sendOtp: (phone: string) => Promise<{ devOtp?: string }>
  confirmOtp: (phone: string, otp: string) => Promise<AuthUser>
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

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      isStaff: user?.role === 'admin',
      sendOtp,
      confirmOtp,
      logout,
      refreshUser,
    }),
    [user, isLoading, sendOtp, confirmOtp, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../lib/auth'
import { useCopy } from '../../i18n'

export function ProtectedRoute({
  children,
  staffOnly = false,
}: {
  children: ReactNode
  staffOnly?: boolean
}) {
  const { isAuthenticated, isStaff, isLoading } = useAuth()
  const location = useLocation()
  const c = useCopy()

  if (isLoading) {
    return (
      <div
        className="container-page flex min-h-[50vh] items-center justify-center py-20"
        role="status"
        aria-live="polite"
      >
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-r-transparent"
          aria-hidden="true"
        />
        <span className="sr-only">{c.common.loading}</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (staffOnly && !isStaff) {
    return <Navigate to="/application-status" replace />
  }

  return <>{children}</>
}

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { ButtonLink } from '../components/ui/Button'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'

/**
 * Landing point for the Supabase Google OAuth redirect. The Supabase client
 * reads the session from the URL, then we exchange it for an Agiza JWT and send
 * the account to the dashboard that matches its role.
 */
export function AuthCallback() {
  const { completeSupabaseSignIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const user = await completeSupabaseSignIn()
        if (!active) return
        if (user.role === 'admin') {
          // Platform administration has its own Google sign-in at /admin.
          navigate('/', { replace: true })
        } else if (user.role === 'vendor' || user.role === 'rider') {
          navigate('/application-status', { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      } catch (err) {
        if (!active) return
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Unable to finish sign-in. Please try again.',
        )
      }
    })()
    return () => {
      active = false
    }
  }, [completeSupabaseSignIn, navigate])

  return (
    <section className="container-page flex min-h-[calc(100dvh-74px)] items-center py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="surface-card p-8 text-center">
          {error ? (
            <>
              <Alert tone="error" title="Sign-in failed">
                {error}
              </Alert>
              <ButtonLink to="/login" variant="secondary" size="lg" fullWidth className="mt-6">
                Back to sign in
              </ButtonLink>
            </>
          ) : (
            <>
              <span
                className="mx-auto block h-8 w-8 animate-spin rounded-full border-[3px] border-brand-orange border-r-transparent"
                aria-hidden="true"
              />
              <h1 className="mt-5 font-display text-xl font-extrabold tracking-tight text-brand-charcoal">
                Finishing sign-in
              </h1>
              <p className="mt-2 text-sm text-brand-muted">
                Linking your Google account to Agiza…
              </p>
              <p className="mt-6 flex items-start justify-center gap-2 text-xs text-brand-muted">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5" aria-hidden="true" />
                Taking too long? <Link to="/login" className="font-bold underline underline-offset-4">Try again</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

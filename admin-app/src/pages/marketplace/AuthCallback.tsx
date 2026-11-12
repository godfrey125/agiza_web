import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { marketplaceSupabaseExchange } from '../../lib/marketplace'
import { useMarketplaceAuth } from '../../lib/marketplace-auth'
import { readSupabaseAccessToken } from '../../lib/supabase'

/**
 * Landing point for the Supabase Google OAuth redirect. The Supabase client
 * reads the session from the URL, then we exchange it for an Agiza JWT so the
 * platform admin uses the exact same Django permissions as password sign-in.
 */
export default function MarketplaceAuthCallback() {
  const navigate = useNavigate()
  const { signInWithSession } = useMarketplaceAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const accessToken = await readSupabaseAccessToken()
        const response = await marketplaceSupabaseExchange(accessToken)
        if (!active) return
        await signInWithSession(response.tokens, response.user)
        if (active) navigate('/marketplace', { replace: true })
      } catch (cause) {
        if (!active) return
        setError(
          cause instanceof Error
            ? cause.message
            : 'Google sign-in could not be completed. Please try again.',
        )
      }
    })()
    return () => {
      active = false
    }
  }, [navigate, signInWithSession])

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
        {error ? (
          <>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-soft-red text-coral">
              <AlertCircle size={22} />
            </span>
            <h1 className="mt-4 font-display text-xl font-extrabold tracking-[-0.03em] text-ink">
              Sign-in failed
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">{error}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Link to="/marketplace" className="btn-primary w-full">
                Try again
              </Link>
              <Link to="/" className="btn-secondary w-full">
                Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-peach text-primary">
              <ShieldCheck size={22} />
            </span>
            <h1 className="mt-4 font-display text-xl font-extrabold tracking-[-0.03em] text-ink">
              Opening Agiza Admin
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Verifying your Google account and platform permissions…
            </p>
            <Loader2 size={22} className="mx-auto mt-5 animate-spin text-primary" />
          </>
        )}
      </div>
    </div>
  )
}

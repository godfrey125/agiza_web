import { useState, type ReactNode } from 'react'
import { AlertCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '../ui'
import { useMarketplaceAuth } from '../../lib/marketplace-auth'
import { marketplaceConfig } from '../../lib/marketplace'
import { signInWithGoogle, supabaseConfigured } from '../../lib/supabase'

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.7 9.4 5.9 12 5.9Z" />
    </svg>
  )
}

export function MarketplaceGate({ children }: { children: ReactNode }) {
  const { admin, loading, error } = useMarketplaceAuth()
  const [googleBusy, setGoogleBusy] = useState(false)
  const [formError, setFormError] = useState('')

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
          <p className="text-sm font-medium text-muted">Checking administrator access…</p>
        </div>
      </div>
    )
  }

  if (admin) return <>{children}</>

  const startGoogle = async () => {
    setFormError('')
    setGoogleBusy(true)
    try {
      const base = import.meta.env.BASE_URL || '/admin/'
      await signInWithGoogle(`${window.location.origin}${base}marketplace/auth/callback`)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Google sign-in could not start.')
      setGoogleBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-peach text-primary">
            <LockKeyhole size={20} />
          </span>
          <div>
            <p className="eyebrow">Restricted area</p>
            <h1 className="font-display text-2xl font-extrabold tracking-[-0.03em] text-ink">
              Agiza Admin
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">
              Platform control center
            </p>
          </div>
        </div>

        <div className="card p-6">
          <p className="text-sm leading-6 text-muted">
            Sign in with the Agiza platform administrator Google account to manage live orders,
            riders, food, vendors, payments, partner applications, accounts, trust &amp; safety and
            staff roles.
          </p>

          <Button
            type="button"
            variant="secondary"
            className="mt-5 w-full"
            onClick={startGoogle}
            loading={googleBusy}
            disabled={googleBusy || !supabaseConfigured}
          >
            <GoogleMark />
            Continue with Google
          </Button>
          {!supabaseConfigured ? (
            <p className="mt-2 text-[11px] leading-5 text-muted">
              Google sign-in needs <span className="font-semibold text-ink">VITE_SUPABASE_URL</span>{' '}
              and <span className="font-semibold text-ink">VITE_SUPABASE_ANON_KEY</span>.
            </p>
          ) : null}

          {formError || error ? (
            <p className="mt-4 flex items-start gap-1.5 text-xs font-medium text-coral" role="alert">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {formError || error}
            </p>
          ) : null}

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#fcf8f2] px-3 py-2.5 text-[11px] leading-5 text-muted">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" />
            <span>
              Only <span className="font-semibold text-ink">{marketplaceConfig.adminEmail}</span> is
              allowed. Every action is written to the backend audit log.
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center text-[11px]">
          <a
            href={import.meta.env.VITE_AGIZA_WEBSITE_URL || '/'}
            className="font-semibold text-muted hover:text-primary"
          >
            Agiza website
          </a>
        </div>
      </div>
    </div>
  )
}

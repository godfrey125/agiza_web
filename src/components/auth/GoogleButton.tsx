import { useState } from 'react'
import { Button } from '../ui/Button'
import { useAuth } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.95 11.95 0 0 0 12 0 12 12 0 0 0 1.29 6.63l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  )
}

interface GoogleButtonProps {
  label?: string
  className?: string
  onError?: (message: string) => void
}

/**
 * Starts Supabase's Google OAuth flow. Hidden until the runtime config contains
 * the project URL and public key, so a half-configured deploy never shows a
 * button that cannot work.
 */
export function GoogleButton({ label = 'Continue with Google', className, onError }: GoogleButtonProps) {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)

  if (!isSupabaseConfigured) return null

  const start = async () => {
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      setBusy(false)
      onError?.(
        error instanceof Error ? error.message : 'Google sign-in is unavailable right now.',
      )
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      fullWidth
      className={className}
      loading={busy}
      disabled={busy}
      onClick={start}
    >
      {busy ? null : <GoogleMark />}
      {label}
    </Button>
  )
}

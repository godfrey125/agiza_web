import { createClient } from '@supabase/supabase-js'

/**
 * Google sign-in for the platform admin.
 *
 * We reuse the same Supabase project as the public Agiza website, so there is
 * no second auth server and no second OAuth client. The Supabase session is
 * exchanged for an Agiza JWT at `/users/auth/supabase/` before the admin panel
 * opens.
 */
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const supabaseConfigured = Boolean(url && anonKey)

const FLOW_ID_KEY = 'agiza.admin.pkce-flow-id'

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The callback page exchanges the PKCE code itself so it can surface
        // the real Supabase error instead of a generic "session missing" one.
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null

export async function signInWithGoogle(redirectTo: string) {
  if (!supabase) {
    throw new Error(
      'Google sign-in is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) throw error
  if (data?.flowId) {
    try {
      sessionStorage.setItem(FLOW_ID_KEY, data.flowId)
    } catch {
      // Storage can be unavailable in strict privacy modes. The callback still
      // falls back to Supabase's legacy single-flow verifier key.
    }
  }
}

function storageHasVerifier(storage: Storage) {
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key && key.endsWith('-code-verifier')) return true
  }
  return false
}

function hasCodeVerifier() {
  try {
    return storageHasVerifier(localStorage) || storageHasVerifier(sessionStorage)
  } catch {
    return false
  }
}

function readUrlPart(part: 'search' | 'hash') {
  const raw = part === 'search' ? window.location.search : window.location.hash.replace(/^#/, '')
  return new URLSearchParams(raw)
}

function authErrorFromUrl() {
  const params = readUrlPart('search')
  const hash = readUrlPart('hash')
  const error = params.get('error') || hash.get('error')
  const description =
    params.get('error_description') || hash.get('error_description') || params.get('error_code')
  if (!error) return null
  return description ? `${error}: ${description}` : error
}

let pendingExchange: Promise<string> | null = null

async function exchangeCallbackCode(): Promise<string> {
  if (!supabase) {
    throw new Error('Google sign-in is not configured.')
  }

  const params = readUrlPart('search')
  const hash = readUrlPart('hash')
  const urlError = authErrorFromUrl()
  if (urlError) {
    throw new Error(`Google sign-in was rejected by the identity provider (${urlError}).`)
  }

  const code = params.get('code')
  if (code) {
    if (!hasCodeVerifier()) {
      throw new Error(
        'The Google sign-in started on a different address. Open the admin console at the same host you used to sign in (for example, use 127.0.0.1 consistently instead of mixing it with localhost) and try again.',
      )
    }
    const storedFlowId = (() => {
      try {
        return sessionStorage.getItem(FLOW_ID_KEY)
      } catch {
        return null
      }
    })()
    const flowId = params.get('sb_flow_id') || storedFlowId
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    )
    if (error) throw new Error(`Google sign-in could not be completed: ${error.message}`)
    if (data.session?.access_token) {
      try {
        sessionStorage.removeItem(FLOW_ID_KEY)
      } catch {
        // Ignore storage errors.
      }
      return data.session.access_token
    }
  }

  // Implicit-flow fallback, in case the Supabase project is switched away from
  // PKCE later.
  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw new Error(`Google sign-in could not be completed: ${error.message}`)
    if (data.session?.access_token) return data.session.access_token
  }

  // The public website and the admin console share the same Supabase storage
  // key on the same origin, so an existing session is also valid here.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw new Error(`Google sign-in could not be read: ${error.message}`)
    if (data.session?.access_token) return data.session.access_token
    await new Promise((resolve) => window.setTimeout(resolve, 250))
  }

  const hint = code
    ? 'The authorization code was received but Supabase did not return a session.'
    : 'Supabase did not return an authorization code.'
  throw new Error(
    `${hint} Check that ${window.location.origin}${window.location.pathname} is listed in Supabase Auth → URL Configuration → Redirect URLs, then try again.`,
  )
}

export async function readSupabaseAccessToken(): Promise<string> {
  if (!supabase) {
    throw new Error('Google sign-in is not configured.')
  }
  if (!pendingExchange) {
    pendingExchange = exchangeCallbackCode().finally(() => {
      pendingExchange = null
    })
  }
  return pendingExchange
}

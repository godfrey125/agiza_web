import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, siteConfig } from './config'

/**
 * Browser Supabase client used only for identity (Google/email sign-in).
 * Business data still lives in the Django API. When the runtime config has not
 * been filled in yet, `supabase` is null and the Google button stays hidden.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(siteConfig.supabaseUrl, siteConfig.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null

export { isSupabaseConfigured }

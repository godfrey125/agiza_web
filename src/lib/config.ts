type RuntimeConfig = Partial<{
  apiBaseUrl: string
  siteUrl: string
  partnerApiBaseUrl: string
  contactEndpoint: string
  apkUrl: string
  supabaseUrl: string
  supabaseAnonKey: string
}>

/**
 * Values from /runtime-config.js override the build-time VITE_* defaults, so a
 * deployed build can be repointed at a new API without rebuilding the bundle.
 */
const runtimeConfig: RuntimeConfig =
  (typeof window !== 'undefined' && window.__AGIZA_CONFIG__) || {}

const resolveUrl = (
  runtimeValue: string | undefined,
  envValue: string | undefined,
  fallback: string,
) => (runtimeValue || envValue || fallback).replace(/\/$/, '')

export const siteConfig = {
  name: 'Agiza',
  tagline: 'Good food. Your way.',
  description:
    'A Tanzanian food marketplace for discovery, dine-in ordering, delivery and custom food requests.',
  /**
   * Supabase owns Google and email identity. The public anon/publishable key is
   * safe to ship in the browser; the backend verifies the resulting token.
   */
  supabaseUrl: resolveUrl(
    runtimeConfig.supabaseUrl,
    import.meta.env.VITE_SUPABASE_URL,
    '',
  ),
  supabaseAnonKey:
    runtimeConfig.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  /** Existing Django REST API (Flutter app uses the same service). */
  apiBaseUrl: resolveUrl(
    runtimeConfig.apiBaseUrl,
    import.meta.env.VITE_API_BASE_URL,
    import.meta.env.DEV ? 'http://localhost:8000/api' : '/api',
  ),
  /**
   * Partner application endpoints that must be provided by the trusted backend.
   * The frontend never fakes submission, references or verification states.
   */
  partnerApiBaseUrl: resolveUrl(
    runtimeConfig.partnerApiBaseUrl,
    import.meta.env.VITE_PARTNER_API_BASE_URL,
    '',
  ),
  /**
   * Optional contact form endpoint. The verified Agiza contact channels have not
   * been supplied, so no phone number, email address or social account is invented.
   */
  contactEndpoint: resolveUrl(
    runtimeConfig.contactEndpoint,
    import.meta.env.VITE_CONTACT_ENDPOINT,
    '',
  ),
  siteUrl: runtimeConfig.siteUrl || import.meta.env.VITE_SITE_URL || '',
  support: {
    /** Intentionally empty until verified by Agiza. */
    email: '',
    phone: '',
    address: '',
    hours: '',
    social: {
      instagram: '',
      facebook: '',
      x: '',
      tiktok: '',
    },
  },
  /**
   * App availability. The supplied Android APK is served locally by default.
   * Store badges and release metadata remain blank until they are verified, so
   * the site never invents a store listing or release detail.
   */
  app: {
    /**
     * Direct Android APK download. The file lives in public/downloads so it is
     * copied into the production build. Override with VITE_APP_APK_URL only if
     * the same APK is hosted elsewhere.
     */
    apkUrl: runtimeConfig.apkUrl || import.meta.env.VITE_APP_APK_URL || '/downloads/agiza.apk',
    version: import.meta.env.VITE_APP_VERSION || '',
    size: import.meta.env.VITE_APP_SIZE || '',
    releaseDate: import.meta.env.VITE_APP_RELEASE_DATE || '',
    minAndroid: import.meta.env.VITE_APP_MIN_ANDROID || '',
    minIos: import.meta.env.VITE_APP_MIN_IOS || '',
    changelogUrl: import.meta.env.VITE_APP_CHANGELOG_URL || '',
    links: {
      playStore: import.meta.env.VITE_APP_PLAY_STORE_URL || '',
      appStore: import.meta.env.VITE_APP_APP_STORE_URL || '',
    },
  },
  legal: {
    entityName: '',
    lastUpdated: 'To be confirmed',
  },
} as const

export const isPartnerApiConfigured = Boolean(siteConfig.partnerApiBaseUrl)
export const isContactEndpointConfigured = Boolean(siteConfig.contactEndpoint)
export const isSupabaseConfigured = Boolean(siteConfig.supabaseUrl && siteConfig.supabaseAnonKey)

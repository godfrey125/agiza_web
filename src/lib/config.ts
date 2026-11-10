export const siteConfig = {
  name: 'Agiza',
  tagline: 'Good food. Your way.',
  description:
    'A Tanzanian food marketplace for discovery, dine-in ordering, delivery and custom food requests.',
  /** Existing Django REST API (Flutter app uses the same service). */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/$/, ''),
  /**
   * Partner application endpoints that must be provided by the trusted backend.
   * The frontend never fakes submission, references or verification states.
   */
  partnerApiBaseUrl: (import.meta.env.VITE_PARTNER_API_BASE_URL || '').replace(/\/$/, ''),
  /**
   * Optional contact form endpoint. The verified Agiza contact channels have not
   * been supplied, so no phone number, email address or social account is invented.
   */
  contactEndpoint: (import.meta.env.VITE_CONTACT_ENDPOINT || '').replace(/\/$/, ''),
  siteUrl: import.meta.env.VITE_SITE_URL || '',
  /**
   * Restaurant analytics workspace (Agiza Analytics). Approved vendors open
   * their dashboard from the navigation, footer and vendor page.
   */
  analyticsUrl: (import.meta.env.VITE_ANALYTICS_URL || 'http://localhost:5173').replace(/\/$/, ''),
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
    apkUrl: import.meta.env.VITE_APP_APK_URL || '/downloads/agiza.apk',
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

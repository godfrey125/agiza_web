/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_AGIZA_WEBSITE_URL?: string
  readonly VITE_AGIZA_APK_URL?: string
  readonly VITE_AGIZA_API_URL?: string
  readonly VITE_ADMIN_API_URL?: string
  readonly VITE_AGIZA_ADMIN_EMAIL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

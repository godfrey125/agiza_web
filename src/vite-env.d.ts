/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_PARTNER_API_BASE_URL?: string
  readonly VITE_CONTACT_ENDPOINT?: string
  readonly VITE_SITE_URL?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_APP_SIZE?: string
  readonly VITE_APP_RELEASE_DATE?: string
  readonly VITE_APP_MIN_ANDROID?: string
  readonly VITE_APP_MIN_IOS?: string
  readonly VITE_APP_CHANGELOG_URL?: string
  readonly VITE_APP_PLAY_STORE_URL?: string
  readonly VITE_APP_APP_STORE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

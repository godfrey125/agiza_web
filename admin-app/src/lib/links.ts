/**
 * Public links to the wider Agiza ecosystem.
 *
 * These are safe to expose in the browser bundle. Override them at build time
 * when the Agiza website or the APK are hosted on a different origin, e.g.
 * `VITE_AGIZA_WEBSITE_URL=https://agiza.co.tz npm run build`.
 */
export const agizaLinks = {
  website: (import.meta.env.VITE_AGIZA_WEBSITE_URL || 'http://localhost:8080').replace(/\/$/, ''),
  apk: import.meta.env.VITE_AGIZA_APK_URL || 'http://localhost:8080/downloads/agiza.apk',
}

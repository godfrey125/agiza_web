# App store badge assets

These images are official store badges. They are rendered only when the matching
published listing URL is configured:

| File | Official source | Environment variable |
| --- | --- | --- |
| `google-play.png` | Google Play badge assets, `play.google.com/intl/en_us/badges/` | `VITE_APP_PLAY_STORE_URL` |
| `app-store.svg` | Apple App Store badge assets, `developer.apple.com/assets/elements/badges/` | `VITE_APP_APP_STORE_URL` |

Do not recolour, crop, rearrange or re-create these images. Use the supplied
files unmodified, at a readable size, and only link them to the genuine listing
for a published Agiza app.

If a listing is not published, leave its environment variable blank. The
homepage then shows a clearly labelled “Coming soon” platform card instead of a
download badge.

## Direct Android APK

The Android APK supplied for Agiza is served from `public/downloads/agiza.apk`
and is separate from the store badges. `VITE_APP_APK_URL` defaults to
`/downloads/agiza.apk`. The site presents the APK as a direct Android download;
it does not imply a Google Play or App Store listing.

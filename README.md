# Agiza web

Public website and partner onboarding frontend for **Agiza**, a Tanzanian food
marketplace. The site covers food discovery, dine-in ordering, delivery and
custom food requests, with English/Kiswahili content and mobile-first vendor and
rider application flows.

This repository is the **frontend only**. It does not modify the existing
Django/Flutter project and it never invents approvals, reference numbers,
contact details or verification results.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS with Agiza brand tokens
- React Router
- React Hook Form + Zod
- Framer Motion and Lucide React
- Local fonts and locally stored food photography
- Existing Django phone OTP + SimpleJWT authentication

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

The development server runs on **http://localhost:8080** because the existing
Django CORS configuration allows that origin.

```bash
npm run build      # TypeScript check + production build
npm run preview    # preview the production build
npm run lint       # oxlint
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Home |
| `/about` | About Agiza |
| `/services` | Services |
| `/how-it-works` | Customer, vendor and rider journey |
| `/vendors` | Vendor information and application entry |
| `/riders` | Rider information and application entry |
| `/get-started` | Choose a partner path |
| `/login` | Phone OTP sign-in against the existing Django API |
| `/register/vendor` | Protected five-step vendor application |
| `/register/rider` | Protected five-step rider application |
| `/application-status` | Protected, server-confirmed application tracking |
| `/admin/applications` | Protected staff review queue |
| `/contact`, `/faq` | Support information and contact form |
| `/privacy`, `/terms` | Legal drafts marked for legal review |

## Environment

See `.env.example` and `docs/PARTNER_API.md`.

| Variable | Behaviour when blank |
| --- | --- |
| `VITE_API_BASE_URL` | Falls back to `http://localhost:8000/api` |
| `VITE_PARTNER_API_BASE_URL` | Registration submission, tracking and staff review stay disabled |
| `VITE_CONTACT_ENDPOINT` | Contact form is disabled |
| `VITE_SITE_URL` | No canonical domain is assumed |

App availability is also environment-driven. The supplied Android APK is served
from `public/downloads/agiza.apk` by default. Store links and release details stay
blank until they are genuine and verified:

| Variable | Purpose |
| --- | --- |
| `VITE_APP_APK_URL` | Direct Android APK download; defaults to `/downloads/agiza.apk` |
| `VITE_APP_VERSION` | Current published app version |
| `VITE_APP_SIZE` | Download size, for example `42 MB` |
| `VITE_APP_RELEASE_DATE` | Latest release date |
| `VITE_APP_MIN_ANDROID` / `VITE_APP_MIN_IOS` | Minimum supported OS versions |
| `VITE_APP_CHANGELOG_URL` | Changelog link |
| `VITE_APP_PLAY_STORE_URL` | Google Play listing |
| `VITE_APP_APP_STORE_URL` | Apple App Store listing |

The Android APK can be downloaded directly from the site. A store badge is enabled
only when its URL is set. Until then the homepage shows a clearly marked “Coming
soon” platform card for that store. See [`docs/APP_BADGES.md`](docs/APP_BADGES.md)
for badge sources and usage rules.

All `VITE_*` values are public in the browser bundle. Do not put secrets there.

## Authentication

The frontend uses the existing Django endpoints:

- `POST /users/auth/request-otp/`
- `POST /users/auth/verify-otp/`
- `POST /users/auth/token/refresh/`
- `GET /users/me/`

A verified phone number is required before a vendor or rider can open an
application. The application form does not create a separate password. JWT
tokens are stored in local storage by the existing client and sent as
`Authorization: Bearer <access>` to partner API endpoints.

Development OTPs are displayed only when the Django endpoint returns `dev_otp`.
The development warning itself is hidden in production builds.

## Partner application contract

The intended backend contract is documented in
[`docs/PARTNER_API.md`](docs/PARTNER_API.md). It covers:

- document requirements by application type and stage;
- multipart vendor/rider submissions with files;
- applicant status reads;
- staff review queues and decisions;
- contact form submission.

Until that trusted backend exists, the registration forms remain fully usable
for drafting and validation, but the final submit button is disabled and the UI
states clearly that the verification service is not connected. The status and
admin pages show the same explicit state instead of fake applications or
approvals.

## Document uploads

- Accepted types: PDF, JPG/JPEG and PNG (photos are image-only).
- Per-file limit: 10 MB by default.
- Requirements and mandatory flags come from the partner API when configured.
- Without the partner API, a clearly labelled **preview** list is shown. It is
  not authoritative, uploads are not accepted, and nothing is submitted.
- Drafts persist text fields in local storage. Browsers cannot persist selected
  `File` objects, so files must be selected again after a reload.

## Known limitations

- The existing Django project has no partner application, document storage,
  verification or admin review endpoints. Those endpoints must be implemented
  and deployed before launch.
- No verified Agiza phone number, email address, physical address or social
  account was supplied. `src/lib/config.ts` deliberately leaves them blank.
- Privacy and Terms are drafts and are marked as requiring legal review.
- The site does not implement payments, live order tracking or delivery
  dispatch. Those remain outside this frontend scope.

## Deployment

1. Set the production `VITE_*` values at build time.
2. Run `npm run build`.
3. Serve `dist/` over HTTPS.
4. Configure SPA fallback so unknown paths return `index.html`.
5. Add the deployed origin to the Django and partner API CORS allow-list.
6. Verify the partner API over HTTPS before enabling submission.
7. Serve `/downloads/agiza.apk` as `application/vnd.android.package-archive` with
   `Content-Disposition: attachment; filename="agiza.apk"` so Android browsers
   download the supplied APK correctly.

### Vercel

`vercel.json` configures the Vite build, SPA fallback, and the APK response
headers. Import `godfrey125/agiza_web` in Vercel, or deploy with the Vercel CLI.
Set the production `VITE_*` values in the Vercel project before deploying,
especially:

- `VITE_API_BASE_URL` — the public HTTPS URL of the Django API, not
  `localhost`.
- `VITE_SITE_URL` — the final Vercel or custom domain.
- `VITE_PARTNER_API_BASE_URL` and `VITE_CONTACT_ENDPOINT` — only when those
  services are live.

Vite bakes `VITE_*` values into the built assets, so changing an environment
variable in Vercel requires a redeploy. The APK is 23 MB, which is within
Vercel's 100 MB static-file limit for Hobby projects. If you later move the APK
to external storage, set `VITE_APP_APK_URL` to its public HTTPS URL.

## Verification checklist

- `npm run build` succeeds with no TypeScript errors.
- EN/SW switching updates navigation, pages, forms, validation and statuses.
- Phone OTP login works against the configured Django API.
- Registration routes redirect unauthenticated visitors to `/login`.
- Submission is disabled with a clear message when the partner API is absent.
- No contact details, approvals, reference numbers, testimonials, partner logos
  or business statistics are invented.
- Privacy and Terms display the legal-review notice.

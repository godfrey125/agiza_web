# Agiza web

Public website, partner onboarding frontend, marketplace API and the private
restaurant/marketplace admin console for **Agiza**, a Tanzanian food marketplace.
The site covers food discovery, dine-in ordering, delivery and custom food
requests, with English/Kiswahili content and mobile-first vendor and rider
application flows.

The repository is now a **single deployment**: the public site is served at `/`,
the admin console at `/admin`, the Django marketplace API at `/api`, and the
restaurant workspace API at `/api/restaurant`. All persistent data lives in
Supabase Postgres.

This project never invents approvals, reference numbers, contact details, visitor
statistics or verification results. Visitor analytics and the staff dashboard
read from the Django backend; if that backend is not configured, the dashboard
shows an explicit unavailable state instead of sample numbers.

### Live deployment

- Public site: `https://agizawebs.vercel.app`
- Admin console: `https://agizawebs.vercel.app/admin/`
- Supabase project: `prhnakmkhbxxobzidijj`
- Supabase Auth Site URL: `https://agizawebs.vercel.app`

The Supabase redirect allow-list includes the production website callback,
the admin callback, the legacy Firebase origins, local development origins and
the Android `agiza://` deep links. The only accepted admin identity is
`shorahgodfrey12@gmail.com`.

## Stack

- React 19 + TypeScript + Vite (public site and admin SPA)
- Tailwind CSS with Agiza brand tokens
- React Router
- React Hook Form + Zod
- Framer Motion and Lucide React
- Django REST Framework + SimpleJWT (marketplace API)
- Express + `pg` (restaurant workspace API)
- Supabase Postgres (single source of truth)
- Supabase Auth with Google sign-in (admin console)
- Vercel Services (one project, one domain)

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/` | Public website |
| `admin-app/` | Admin SPA, served at `/admin` |
| `backend/` | Django marketplace API, served at `/api` |
| `server/` | Restaurant workspace API, served at `/api/restaurant` |
| `supabase/migrations/` | Restaurant schema and upload storage |
| `vercel.json` | Vercel Services routing for the whole deployment |

## Quick start

Install the JavaScript dependencies once at the repository root, then install the
admin app and restaurant API dependencies:

```bash
npm install
npm --prefix admin-app install
npm --prefix server install
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
```

Start each service in its own terminal:

```bash
# Public site: http://localhost:8080
npm run dev

# Admin SPA: http://127.0.0.1:5173/admin/
npm --prefix admin-app run dev

# Restaurant API: http://127.0.0.1:8787/api
npm --prefix server run dev

# Django marketplace API: http://127.0.0.1:8000/api
cd backend && .venv/bin/python manage.py runserver 127.0.0.1:8000
```

The admin app's Vite proxy forwards `/api/restaurant` to the restaurant API and
`/api` to Django, so the browser contract matches production.

`npx vercel dev --local` starts all four services and is useful for checking the
API and public-site routing. The admin service currently redirects `/admin/` in
a loop under `vercel dev` because the Vite dev server already uses `/admin/` as
its base while the service route strips that prefix for production. Use the
individual dev servers above for admin UI work; the production build is
unaffected (the transformed static handler was verified with the built
`admin-app/dist`).

```bash
npm run build                    # public site build
npm --prefix admin-app run build # admin SPA build
npm run lint                     # oxlint
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
| `/contact`, `/faq` | Support information and contact form |
| `/privacy`, `/terms` | Legal drafts marked for legal review |
| `/admin` | Private admin console (Google sign-in only, not linked from the public site) |

## Environment

See `.env.example`, `admin-app/.env.example`, `server/.env.example` and
`backend/.env.example`.

### Public site

| Variable | Behaviour when blank |
| --- | --- |
| `VITE_API_BASE_URL` | Uses the same-origin `/api` in production and `http://localhost:8000/api` in development |
| `VITE_PARTNER_API_BASE_URL` | Registration submission, tracking and staff review stay disabled |
| `VITE_CONTACT_ENDPOINT` | Contact form is disabled |
| `VITE_SITE_URL` | No canonical domain is assumed |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Google/email sign-in stays hidden; phone OTP still works |

### Admin app

| Variable | Purpose |
| --- | --- |
| `VITE_AGIZA_API_URL` | Django marketplace API base. Defaults to `/api` |
| `VITE_ADMIN_API_URL` | Restaurant workspace API base. Defaults to `/api/restaurant` |
| `VITE_AGIZA_ADMIN_EMAIL` | The single Google account allowed into `/admin` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase project used for Google sign-in |

### Django marketplace API

Set these in the `django` Vercel service:

- `SECRET_KEY` — long random value; signs SimpleJWT access tokens
- `DEBUG=false`
- `ALLOWED_HOSTS` — include `.vercel.app` and the production domain
- `DATABASE_URL` — Supabase Postgres connection string. Use the transaction
  pooler (port `6543`) on Vercel so serverless instances share the project
  connection budget.
- `DATABASE_CONN_MAX_AGE=0` — close Django connections after each request
  (the default). The session pooler is capped at 15 clients.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — identity verification
- `PLATFORM_ADMIN_EMAIL=shorahgodfrey12@gmail.com`
- `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` — production origins
- Optional: `FIREBASE_*`, `REDIS_URL`, `OTP_SMS_WEBHOOK_*`

### Restaurant workspace API

Set these in the `restaurant` Vercel service:

- `DATABASE_URL` — the same Supabase Postgres connection string, using the
  **session pooler** (port `5432`). The restaurant schema relies on
  `search_path`, which transaction pooling does not preserve reliably.
- `RESTAURANT_DATABASE_URL` — optional override for this service. Set it to the
  session pooler URL when `DATABASE_URL` is the Django transaction-pooler URL.
- `PG_POOL_MAX=2` — keep the restaurant pool small so it does not consume the
  project-wide session client limit.
- `DJANGO_JWT_SECRET` — **must equal the Django `SECRET_KEY`**
- `PLATFORM_ADMIN_EMAIL=shorahgodfrey12@gmail.com`
- `AUTH_SECRET` — long random value for legacy restaurant sessions
- `AGIZA_API_PREFIX=/api` (the default; the Vercel route transform maps
  `/api/restaurant/*` to `/api/*`)

All `VITE_*` values are public in the browser bundle. Do not put secrets there.

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

## Agiza Admin (platform control center)

The **Agiza Admin** console is served from `/admin` on the same domain as the
public site. It combines the restaurant workspace (dashboard, menu, orders,
inventory, reports, marketing, reviews, settings) with the marketplace admin
sections (partner applications, account governance, trust and safety, audit
history, staff roles and website visitor analytics).

It is not linked from the public website; open `/admin` directly. Access is
restricted to one Google account, `shorahgodfrey12@gmail.com`, both in the
Supabase Google flow and on the Django backend (`PLATFORM_ADMIN_EMAIL`).

## Authentication

Agiza uses two complementary sign-in paths. Both end with the same Django JWT
pair, so every API endpoint and role rule stays unchanged.

**Phone OTP (Django)** — used by customers, vendors and riders:

- `POST /users/auth/request-otp/`
- `POST /users/auth/verify-otp/`
- `POST /users/auth/token/refresh/`
- `GET /users/me/`

**Google / email (Supabase identity)** — optional, enabled only when the
Supabase project is configured:

1. The browser signs in with `supabase.auth.signInWithOAuth({ provider: 'google' })`
   and returns to `/auth/callback`.
2. `POST /users/auth/supabase/` verifies the Supabase access token against the
   project's public JWKS, creates or links the Agiza account, and returns the
   normal Agiza JWT pair.

A verified phone number is still required before a vendor or rider can open an
application. The application form does not create a separate password. JWT
tokens are stored in local storage by the existing client and sent as
`Authorization: Bearer <access>` to partner API endpoints.

**Admin console (Google only)** — `/admin` uses Supabase Google sign-in:

1. The admin SPA signs in with Supabase and returns to
   `/admin/marketplace/auth/callback`.
2. It exchanges the Supabase access token at `POST /api/users/auth/supabase/`.
   The Django backend verifies the token, auto-provisions the platform admin on
   the first successful exchange, and returns the normal Agiza JWT pair.
3. The same Django JWT is sent to both `/api` and `/api/restaurant`, so the
   marketplace and restaurant workspace share one session. The restaurant API
   verifies the Django JWT with `DJANGO_JWT_SECRET`.

The admin console is restricted to `PLATFORM_ADMIN_EMAIL` on the Django backend
and to `VITE_AGIZA_ADMIN_EMAIL` in the browser. The public site no longer exposes
any `/admin` link.

### Supabase project setup

Set these in `.env.local` (or the deployment's runtime config):

- `VITE_SUPABASE_URL` — the project URL, e.g.
  `https://prhnakmkhbxxobzidijj.supabase.co`
- `VITE_SUPABASE_ANON_KEY` — the publishable/anon key (safe in the browser)

In the Supabase dashboard:

1. **Authentication → Providers → Google**: enable it with a Google Cloud OAuth
   client ID and secret. Authorized redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
2. **Authentication → URL Configuration**: set the Site URL to the deployed
   origin and add every redirect used by the website, admin console and app.
   The production project is already configured with:
   - `https://agizawebs.vercel.app` (Site URL)
   - `https://agizawebs.vercel.app/auth/callback` (public site)
   - `https://agizawebs.vercel.app/admin/marketplace/auth/callback` (admin console)
   - `https://*-agiza2.vercel.app/**` (preview deployments)
   - `https://agiza-3884d.web.app/**` and `https://agiza-3884d.firebaseapp.com/**`
     (legacy Firebase origins)
   - `http://localhost:8080/auth/callback` (public site in development)
   - `http://localhost:5173/admin/marketplace/auth/callback` and
     `http://127.0.0.1:5173/admin/marketplace/auth/callback` (admin in development)
   - `agiza://login-callback` (Android app)

The Google button stays hidden while the Supabase URL/key are blank, so a
half-configured deploy never shows a sign-in option that cannot work.

**Troubleshooting “The Google session could not be read”** — the admin callback
now shows the real Supabase/provider error. The usual causes are:

- The callback URL is missing from **Authentication → URL Configuration →
  Redirect URLs**. Add the exact origin shown in the error message.
- The sign-in started on a different host than the callback (`localhost` vs
  `127.0.0.1`). PKCE code verifiers are origin-scoped, so use one host
  consistently. The callback detects this and asks you to reopen the console.
- The Google Cloud OAuth client's authorized redirect URI is not
  `https://<project-ref>.supabase.co/auth/v1/callback`.
- The Google consent screen is in **Testing** mode and the admin email is not
  listed as a test user.

**Troubleshooting `EMAXCONNSESSION` / “max clients reached in session mode”** —
the Supabase session pooler (port `5432`) allows only 15 concurrent clients.
Django defaults to `DATABASE_CONN_MAX_AGE=0`, and the restaurant pool defaults
to `PG_POOL_MAX=2`. If the error persists, stop stray local API processes,
restart the services, and use the transaction pooler (port `6543`) for Django
with `RESTAURANT_DATABASE_URL` on the session pooler for the restaurant API.

Development OTPs are displayed only when the Django endpoint returns `dev_otp`.
The development warning itself is hidden in production builds.

Production OTP delivery requires `OTP_SMS_WEBHOOK_URL` on the Django backend. The
backend POSTs `{"phone", "otp", "message"}` to that trusted SMS relay. If it is not
configured outside `DEBUG`, the login endpoint returns `503` instead of claiming
an SMS was sent. Use a shared cache such as Redis for OTPs when running more than
one backend instance.

## Visitor analytics and staff dashboard

The **Agiza Admin** app shows real page views, unique visitors,
sessions, top pages, referral sources, devices, browsers, recent visits and
marketplace counts from the Django backend. It has no hardcoded or sample
numbers. If the API is unreachable or the signed-in user is not an admin, the
page says so and shows no fake data.

The public tracker in `src/lib/analytics.ts` calls:

- `POST /analytics/track/` — anonymous page view, with optional Bearer token when
  the visitor is signed in.

The dashboard calls:

- `GET /analytics/dashboard/?days=7` — staff-only aggregate data.

Privacy behaviour:

- No raw IP address is stored. A random `visitor_id` lives in local storage and a
  random `session_id` lives in session storage; each page view has its own
  `visit_id`.
- Do Not Track is respected.
- Admin and direct-download routes are not tracked.
- Bot and staff page views are recorded separately and excluded from public
  visitor totals.

To create the platform admin locally, run the Django shell after migrations:

```bash
cd backend
.venv/bin/python manage.py shell -c "from users.models import User; U=User; u,_=U.objects.get_or_create(username='shorahgodfrey12@gmail.com', defaults={'email':'shorahgodfrey12@gmail.com'}); u.role=U.Role.ADMIN; u.staff_role=U.StaffRole.SUPER_ADMIN; u.is_staff=True; u.is_active=True; u.set_unusable_password(); u.save()"
```

Then sign in to `/admin` with the Google account
`shorahgodfrey12@gmail.com`. Production needs a shared OTP cache such as Redis
for phone OTP and a strong `SECRET_KEY`; the website uses the same-origin `/api`
on the single Vercel deployment.

## Account governance and control center

The Django backend's `administration` app provides server-enforced account
governance. The Agiza Admin app surfaces it through its
Marketplace section:

- account warnings, suspensions, restrictions, sign-in locks, session revocation,
  restoration and permanent termination;
- violation categories, written reasons, supporting evidence and internal notes;
- immutable audit records with actor, target, reason, category and before/after
  values;
- user notifications and a public appeal endpoint for blocked accounts;
- granular staff roles: `SUPER_ADMIN`, `OPERATIONS_MANAGER`,
  `VERIFICATION_OFFICER`, `FINANCE_OFFICER`, `CUSTOMER_SUPPORT`,
  `TRUST_SAFETY_OFFICER` and `CONTENT_MANAGER`.

The website APIs are under `/api/admin/` plus
`POST /api/account/appeals/public/`. Permanent termination requires a written
reason, evidence and the typed confirmation `TERMINATE`. A blocked user can
submit an appeal from the sign-in page after OTP verification returns `403`;
the public response is deliberately generic to avoid phone-number enumeration.

The backend must run its migrations before these screens are used. Existing
`ADMIN` users are backfilled to `SUPER_ADMIN`; new staff accounts need an
explicit `staff_role` and must not be granted roles their duties do not require.

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

- Partner document storage and the full review workflow still depend on the
  trusted partner API contract. The registration forms remain usable for
  drafting and validation, but submission stays disabled until that service is
  configured.
- No verified Agiza phone number, email address, physical address or social
  account was supplied. `src/lib/config.ts` deliberately leaves them blank.
- Privacy and Terms are drafts and are marked as requiring legal review.
- The site does not implement payments, live order tracking or delivery
  dispatch. Those remain outside this frontend scope.
- The Django admin at `/admin/` is intentionally shadowed by the Agiza admin
  console on the public deployment. Use the Agiza console for operations.

## Deployment

The whole product deploys as one Vercel project using **Vercel Services**. The
root `vercel.json` defines four services and routes them on one domain:

| Service | Root | Public path | Runtime |
| --- | --- | --- | --- |
| `site` | `.` | `/` | Vite |
| `admin` | `admin-app/` | `/admin` | Vite |
| `django` | `backend/` | `/api`, `/static` | Django |
| `restaurant` | `server/` | `/api/restaurant` | Express |

Routing order is specific-first: `/api/restaurant/*` → `restaurant`,
`/api/*` → `django`, `/static/*` → `django`, `/admin/*` → `admin`, and
everything else → `site`. `/admin` redirects to `/admin/`.

### 1. Prepare Supabase

The restaurant schema is in `supabase/migrations/`:

- `20261111000000_restaurant_schema.sql` creates the `restaurant` schema,
  tables, indexes and SQLite-compatibility helpers.
- `20261112000000_restaurant_uploads.sql` creates `restaurant.uploads` for
  Postgres-backed menu images.

Apply them with the Supabase SQL editor or `psql` against the project's
`DATABASE_URL`. The existing public CMS tables (`pages`, `posts`, `profiles`,
`plans`, `site_settings`, …) are untouched.

### 2. Configure environment variables

Set the variables from the four `.env.example` files in the Vercel project.
The most important shared values are:

- `DATABASE_URL` — Supabase Postgres connection string. Use the transaction
  pooler (port `6543`) for `django`.
- `RESTAURANT_DATABASE_URL` — the session pooler (port `5432`) for the
  `restaurant` service. This keeps `search_path` working and prevents the two
  services from competing for the same session client limit.
- `SECRET_KEY` — Django signing key.
- `DJANGO_JWT_SECRET` — same value as `SECRET_KEY` (restaurant service).
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — site and admin services.
- `PLATFORM_ADMIN_EMAIL=shorahgodfrey12@gmail.com`.

Vercel injects the same project environment variables into every service, so
the shared `SECRET_KEY` can be set once. `DATABASE_URL` and
`RESTAURANT_DATABASE_URL` intentionally point at different pooler modes; the
restaurant service reads `RESTAURANT_DATABASE_URL` first and falls back to
`DATABASE_URL`.

### 3. Deploy

Import the repository in Vercel, or run:

```bash
vercel --prod
```

Vercel builds each service separately. The public site output is `dist/`, the
admin output is `admin-app/dist/`, Django runs from `backend/manage.py`, and
the restaurant API runs from `server/index.mjs`.

### 4. Finish Supabase auth configuration

The production project is already configured. For a new environment, add the
redirect URLs in **Authentication → URL Configuration**:

- `https://<production-domain>/auth/callback`
- `https://<production-domain>/admin/marketplace/auth/callback`

Add the production origin to the Django `CORS_ALLOWED_ORIGINS` and
`CSRF_TRUSTED_ORIGINS` values, and set `ALLOWED_HOSTS` to include the Vercel
domain (`.vercel.app`) and any custom domain. The current production values use
`https://agizawebs.vercel.app`.

### 5. First admin sign-in

The first successful Google exchange for `shorahgodfrey12@gmail.com`
auto-provisions the Django admin user (`role=ADMIN`, `staff_role=SUPER_ADMIN`).
The restaurant admin row already exists in `restaurant.users`. No separate
password is created.

### Legacy Firebase Hosting

The previous Firebase Hosting deployment (`agiza-3884d.web.app`) is no longer
the target. The `deploy-firebase.sh` script and `firebase.json` are kept for
reference, but the production deployment is Vercel.

## Verification checklist

- `npm run build` and `npm --prefix admin-app run build` succeed with no
  TypeScript errors.
- EN/SW switching updates navigation, pages, forms, validation and statuses.
- Phone OTP login works against the configured Django API.
- `/admin` opens the Google-only admin console, and only
  `shorahgodfrey12@gmail.com` is accepted.
- The admin JWT opens both the marketplace pages and the restaurant workspace
  pages (dashboard, menu, orders, inventory, reports, marketing, reviews,
  settings).
- Menu image uploads are stored in Postgres and served from
  `/api/restaurant/uploads/:id`.
- Account actions, staff role changes and appeal decisions require the matching
  backend permission and leave audit records.
- Blocked users can submit an appeal from the sign-in page without exposing
  whether a phone number is registered.
- Registration routes redirect unauthenticated visitors to `/login`.
- Submission is disabled with a clear message when the partner API is absent.
- No contact details, approvals, reference numbers, testimonials, partner logos
  or business statistics are invented.
- Privacy and Terms display the legal-review notice.

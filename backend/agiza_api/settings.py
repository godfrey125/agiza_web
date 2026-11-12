"""Agiza backend settings.

Configuration comes from environment variables (see `.env.example`).
SQLite is used when DATABASE_URL is not set (local development);
production should set DATABASE_URL to a PostgreSQL URL.
"""
import os
from datetime import timedelta  # noqa: F401  (handy for overrides)
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in ('1', 'true', 'yes', 'on')


def env_list(name, default=''):
    return [v.strip() for v in os.getenv(name, default).split(',') if v.strip()]


SECRET_KEY = os.getenv('SECRET_KEY', 'dev-insecure-change-me-please-set-a-long-secret-key')
DEBUG = env_bool('DEBUG', True)
ALLOWED_HOSTS = env_list('ALLOWED_HOSTS', 'localhost,127.0.0.1,10.0.2.2,.vercel.app')
# The public tunnel terminates TLS; trust its forwarded scheme so uploaded
# images come back as https URLs (mixed content would be blocked by browsers).
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # third party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    # agiza
    'core',
    'users',
    'vendors',
    'riders',
    'orders',
    'payments',
    'chat',
    'notifications',
    'analytics',
    'administration',
    'partners',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'agiza_api.urls'
WSGI_APPLICATION = 'agiza_api.wsgi.application'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

DATABASES = {
    'default': dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        # Supabase's pooler caps session-mode clients (15 on the free plan).
        # Keeping connections alive per request thread exhausts that budget, so
        # close them after each request by default. Override with
        # DATABASE_CONN_MAX_AGE when using a direct connection.
        conn_max_age=int(os.getenv('DATABASE_CONN_MAX_AGE', '0')),
        conn_health_checks=True,
    )
}
# PgBouncer (Supabase pooler) does not support server-side cursors. Disabling
# them keeps Django compatible with both session and transaction pooler modes.
DATABASES['default']['DISABLE_SERVER_SIDE_CURSORS'] = True

AUTH_USER_MODEL = 'users.User'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
]

LANGUAGE_CODE = 'en'
TIME_ZONE = 'Africa/Dar_es_Salaam'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# The single platform administrator allowed into the partner review console.
PLATFORM_ADMIN_EMAIL = os.getenv('PLATFORM_ADMIN_EMAIL', 'shorahgodfrey12@gmail.com')

# ── Supabase ────────────────────────────────────────────────────────────────
# Supabase owns Google/email identity for the website and app. The Django API
# verifies Supabase access tokens against the project's public JWKS and then
# issues its own JWT pair, so the rest of the API contract is unchanged.
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://prhnakmkhbxxobzidijj.supabase.co').rstrip('/')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', '')
SUPABASE_PUBLISHABLE_KEY = os.getenv('SUPABASE_PUBLISHABLE_KEY', '')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
SUPABASE_JWT_AUDIENCE = os.getenv('SUPABASE_JWT_AUDIENCE', 'authenticated')
SUPABASE_JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET', '')
SUPABASE_AUTO_PROVISION = env_bool('SUPABASE_AUTO_PROVISION', True)

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', '')
CORS_ALLOWED_ORIGIN_REGEXES = [r'^http://(localhost|127\.0\.0\.1)(:\d+)?$'] if DEBUG else []
# Django's admin and session auth need explicit trusted origins on the single
# Vercel domain. The JSON API uses bearer JWTs, so this mainly protects the
# Django admin and the browsable API.
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS', '')
if DEBUG:
    CSRF_TRUSTED_ORIGINS += [
        origin for origin in (
            'http://localhost:8000',
            'http://127.0.0.1:8000',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:8080',
            'http://127.0.0.1:8080',
        ) if origin not in CSRF_TRUSTED_ORIGINS
    ]
# The website sends this to bypass ngrok's free-tier browser interstitial.
CORS_ALLOW_HEADERS = [
    'accept',
    'authorization',
    'content-type',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'ngrok-skip-browser-warning',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        # Website JWT tokens and Flutter Firebase ID tokens share the API.
        'users.authentication.AgizaAuthentication',
        # Session auth only so the browsable API / admin users can poke around locally.
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_FILTER_BACKENDS': ('django_filters.rest_framework.DjangoFilterBackend',),
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'EXCEPTION_HANDLER': 'core.exceptions.api_exception_handler',
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.getenv('JWT_ACCESS_MINUTES', '30'))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.getenv('JWT_REFRESH_DAYS', '14'))),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# Website phone-OTP delivery. In DEBUG the OTP is returned instead of sent.
# Production must point this at a trusted SMS relay; there is no fake fallback.
OTP_SMS_WEBHOOK_URL = os.getenv('OTP_SMS_WEBHOOK_URL', '')
OTP_SMS_WEBHOOK_TOKEN = os.getenv('OTP_SMS_WEBHOOK_TOKEN', '')

SPECTACULAR_SETTINGS = {
    'TITLE': 'Agiza API',
    'DESCRIPTION': 'Food discovery, dine-in ordering and delivery marketplace for Tanzania.',
    'VERSION': '1.0.0',
}

# ── Firebase ────────────────────────────────────────────────────────────────
FIREBASE_PROJECT_ID = os.getenv('FIREBASE_PROJECT_ID', 'agiza-3884d')
# Path to a service-account JSON. Required for FCM, Firestore/RTDB writes and
# creating Firebase users. Token verification works with only the project id.
FIREBASE_CREDENTIALS = os.getenv('FIREBASE_CREDENTIALS', '')
FIREBASE_DATABASE_URL = os.getenv(
    'FIREBASE_DATABASE_URL', f'https://{FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com'
)
FIREBASE_STORAGE_BUCKET = os.getenv('FIREBASE_STORAGE_BUCKET', f'{FIREBASE_PROJECT_ID}.firebasestorage.app')
# Domain used to turn a phone number into a Firebase email/password login.
# MUST match `kPhoneLoginDomain` in the Flutter app.
PHONE_LOGIN_EMAIL_DOMAIN = os.getenv('PHONE_LOGIN_EMAIL_DOMAIN', 'phone.agiza.app')

# ── Agiza business rules ────────────────────────────────────────────────────
AGIZA = {
    'VENDOR_RESPONSE_SECONDS': int(os.getenv('AGIZA_VENDOR_RESPONSE_SECONDS', 60)),
    'CUSTOM_OFFER_WINDOW_SECONDS': int(os.getenv('AGIZA_CUSTOM_OFFER_WINDOW_SECONDS', 300)),
    # After the offer window closes, how long the customer has to pick an offer.
    'CUSTOM_SELECTION_WINDOW_SECONDS': int(os.getenv('AGIZA_CUSTOM_SELECTION_WINDOW_SECONDS', 1800)),
    'CUSTOM_REQUEST_RADIUS_KM': float(os.getenv('AGIZA_CUSTOM_REQUEST_RADIUS_KM', 5)),
    # Straight-line distance × factor approximates road distance until a routing API is wired.
    'ROAD_DISTANCE_FACTOR': float(os.getenv('AGIZA_ROAD_DISTANCE_FACTOR', 1.3)),
    'FEE_ROUNDING_TZS': int(os.getenv('AGIZA_FEE_ROUNDING_TZS', 100)),
    'RIDER_JOB_RADIUS_KM': float(os.getenv('AGIZA_RIDER_JOB_RADIUS_KM', 8)),
}

# ── Background worker (production) ──────────────────────────────────────────
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    'expire-due-requests': {'task': 'orders.tasks.expire_due', 'schedule': 5.0},
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'loggers': {'agiza': {'handlers': ['console'], 'level': 'INFO'}},
}

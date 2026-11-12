#!/usr/bin/env bash
# Build the Agiza website and deploy it to Firebase Hosting.
#
# Usage:
#   AGIZA_API_BASE_URL=https://api.example.com/api ./deploy-firebase.sh
#
# AGIZA_API_BASE_URL is written into dist/runtime-config.js, so the deployed
# bundle talks to that API without being rebuilt. It defaults to the value in
# .env if set, otherwise to the current production API.
set -euo pipefail

cd "$(dirname "$0")"

API_BASE_URL="${AGIZA_API_BASE_URL:-}"
PARTNER_API_BASE_URL="${AGIZA_PARTNER_API_BASE_URL:-}"
APK_URL="${AGIZA_APK_URL:-}"
SUPABASE_URL="${AGIZA_SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${AGIZA_SUPABASE_ANON_KEY:-}"

npm run build

{
  echo "window.__AGIZA_CONFIG__ = {"
  if [[ -n "$API_BASE_URL" ]]; then
    echo "  apiBaseUrl: '${API_BASE_URL}',"
  fi
  if [[ -n "$PARTNER_API_BASE_URL" ]]; then
    echo "  partnerApiBaseUrl: '${PARTNER_API_BASE_URL}',"
  fi
  if [[ -n "$APK_URL" ]]; then
    echo "  apkUrl: '${APK_URL}',"
  fi
  if [[ -n "$SUPABASE_URL" ]]; then
    echo "  supabaseUrl: '${SUPABASE_URL}',"
  fi
  if [[ -n "$SUPABASE_ANON_KEY" ]]; then
    echo "  supabaseAnonKey: '${SUPABASE_ANON_KEY}',"
  fi
  echo "};"
} > dist/runtime-config.js

firebase deploy --only hosting --project agiza-3884d "$@"

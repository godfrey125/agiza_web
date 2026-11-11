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
ANALYTICS_URL="${AGIZA_ANALYTICS_URL:-}"
APK_URL="${AGIZA_APK_URL:-}"

npm run build

{
  echo "window.__AGIZA_CONFIG__ = {"
  if [[ -n "$API_BASE_URL" ]]; then
    echo "  apiBaseUrl: '${API_BASE_URL}',"
  fi
  if [[ -n "$ANALYTICS_URL" ]]; then
    echo "  analyticsUrl: '${ANALYTICS_URL}',"
  fi
  if [[ -n "$APK_URL" ]]; then
    echo "  apkUrl: '${APK_URL}',"
  fi
  echo "};"
} > dist/runtime-config.js

firebase deploy --only hosting --project agiza-3884d "$@"

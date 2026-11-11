/*
 * Agiza runtime configuration.
 *
 * This file is loaded before the app bundle, so deployments can be repointed
 * at a different API without rebuilding. Values here win over the VITE_*
 * build-time defaults.
 *
 * Example:
 *   window.__AGIZA_CONFIG__ = {
 *     apiBaseUrl: 'https://api.agiza.co.tz/api',
 *     analyticsUrl: 'https://analytics.agiza.co.tz',
 *   };
 */
window.__AGIZA_CONFIG__ = window.__AGIZA_CONFIG__ || {};

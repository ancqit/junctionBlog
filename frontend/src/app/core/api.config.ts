/**
 * Same-origin `/api` is rewritten:
 * - Vercel → https://junctionback.onrender.com
 * - Local ng serve → proxy.conf.json (blog server first, then junctionBack)
 *
 * Backend: https://github.com/ancqit/junctionBack
 */
export const API_BASE_URL = '/api';

export const RECAPTCHA_TOKEN_PLACEHOLDER = 'test-token';

export const JUNCTION_TODAY = 'https://junction.today';
export const JUNCTION_WEBSITE = 'https://junction.website';

/**
 * Explicit debug mode for HUD / verbose perf logging.
 * Enable with `?debug=1`, localStorage `capyDebug=1`, or `VITE_CAPY_DEBUG=1`.
 * Never on by default — even in `npm run dev`.
 */
export function isCapyDebug(): boolean {
  if (import.meta.env.VITE_CAPY_DEBUG === '1') return true
  try {
    if (typeof window === 'undefined') return false
    if (new URLSearchParams(window.location.search).get('debug') === '1') return true
    return window.localStorage.getItem('capyDebug') === '1'
  } catch {
    return false
  }
}

/**
 * Browser/runtime helpers for optional integrations (KX-MVP-BETA-001).
 * No `window` at module scope beyond typeof checks.
 */

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

/**
 * Maps generic network errors to user-safe copy (avoid raw "Failed to fetch" in UI).
 */
export function formatOptionalIntegrationError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/failed to fetch/i.test(msg) || /networkerror|load failed|network request failed/i.test(msg)) {
    return 'Network unavailable. Try again later.'
  }
  return msg
}

/**
 * Schedules work after idle or a short timeout (defer non-critical startup).
 */
export function runAfterIdle(fn: () => void, timeoutMs = 2000): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const ric = window.requestIdleCallback
  if (typeof ric === 'function') {
    const id = ric(() => fn(), { timeout: timeoutMs })
    return () => {
      window.cancelIdleCallback?.(id)
    }
  }
  const t = window.setTimeout(fn, Math.min(800, timeoutMs))
  return () => window.clearTimeout(t)
}

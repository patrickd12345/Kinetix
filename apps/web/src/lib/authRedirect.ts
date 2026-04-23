/**
 * Resolves `VITE_AUTH_REDIRECT_URL` for the current browser origin.
 * Guardrails ensure configured redirects cannot cross origins (to prevent cross-product drift),
 * and in dev localhost we also drop non-loopback pins.
 *
 * @param isDev - pass `import.meta.env.DEV` from the client bundle
 */
export function resolveConfiguredAuthRedirectUrl(
  windowOrigin: string,
  configuredRedirectUrl: string | null | undefined,
  _isDev: boolean
): string | null | undefined {
  const trimmed = configuredRedirectUrl?.trim() ?? ''
  if (!trimmed) return configuredRedirectUrl

  try {
    const win = new URL(windowOrigin)
    const cfg = new URL(trimmed)

    // Never allow a configured redirect from a different origin. This prevents
    // cross-product drift (e.g., Kinetix OAuth callbacks landing on Bookiji).
    if (cfg.origin !== win.origin) {
      return null
    }

  
    const winIsLoopback = win.hostname === 'localhost' || win.hostname === '127.0.0.1'
    const cfgIsLoopback = cfg.hostname === 'localhost' || cfg.hostname === '127.0.0.1'
    if (winIsLoopback && !cfgIsLoopback) {
      return null
    }
  } catch {
    return null
  }

  return configuredRedirectUrl
}

/**
 * Builds the absolute URL Supabase uses for magic-link (`emailRedirectTo`) and OAuth (`redirectTo`).
 * When `configuredRedirectUrl` is set (from `VITE_AUTH_REDIRECT_URL`), it pins the callback host/path
 * so login initiated from another origin (e.g. a Bookiji shell) still returns to Kinetix.
 */
export function buildAuthRedirectTarget(options: {
  windowOrigin: string
  configuredRedirectUrl: string | null | undefined
  nextPath?: string
}): string {
  const { windowOrigin, configuredRedirectUrl, nextPath } = options
  const trimmed = configuredRedirectUrl?.trim() ?? ''

  let redirectTarget: URL

  if (trimmed.length > 0) {
    try {
      redirectTarget = new URL(trimmed)
    } catch {
      redirectTarget = new URL('/login', windowOrigin)
    }
    if (redirectTarget.pathname === '' || redirectTarget.pathname === '/') {
      redirectTarget.pathname = '/login'
    }
  } else {
    redirectTarget = new URL('/login', windowOrigin)
  }

  if (nextPath) {
    redirectTarget.searchParams.set('next', nextPath)
  }

  return redirectTarget.toString()
}

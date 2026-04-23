/**
 * Resolves `VITE_AUTH_REDIRECT_URL` for the current browser origin.
 * Guardrails ensure Kinetix OAuth callbacks never drift to non-Kinetix Bookiji hosts.
 *
 * @param isDev - pass `import.meta.env.DEV` from the client bundle
 */

const KINETIX_CANONICAL_ORIGIN = 'https://kinetix.bookiji.com'

function isBookijiHost(hostname: string): boolean {
  return hostname === 'bookiji.com' || hostname.endsWith('.bookiji.com')
}

function isKinetixHost(hostname: string): boolean {
  return hostname === 'kinetix.bookiji.com'
}

function fallbackAuthOrigin(windowOrigin: string): string {
  try {
    const win = new URL(windowOrigin)
    if (isBookijiHost(win.hostname) && !isKinetixHost(win.hostname)) {
      return KINETIX_CANONICAL_ORIGIN
    }
  } catch {
    // Fall through to caller-provided origin.
  }

  return windowOrigin
}

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

    if (isBookijiHost(win.hostname)) {
      if (!isKinetixHost(cfg.hostname)) {
        return null
      }
      return configuredRedirectUrl
    }

    if (cfg.origin !== win.origin) {
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
  const authOrigin = fallbackAuthOrigin(windowOrigin)
  const trimmed = configuredRedirectUrl?.trim() ?? ''

  let redirectTarget: URL

  if (trimmed.length > 0) {
    try {
      redirectTarget = new URL(trimmed)
      if (isBookijiHost(new URL(windowOrigin).hostname) && !isKinetixHost(redirectTarget.hostname)) {
        redirectTarget = new URL('/login', authOrigin)
      }
    } catch {
      redirectTarget = new URL('/login', authOrigin)
    }
    if (redirectTarget.pathname === '' || redirectTarget.pathname === '/') {
      redirectTarget.pathname = '/login'
    }
  } else {
    redirectTarget = new URL('/login', authOrigin)
  }

  if (nextPath) {
    redirectTarget.searchParams.set('next', nextPath)
  }

  return redirectTarget.toString()
}

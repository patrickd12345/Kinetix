/**
 * Resolves `VITE_AUTH_REDIRECT_URL` for the current browser origin.
 * In dev builds, if the app runs on localhost but the env pins a non-localhost URL (e.g. shared
 * Infisical values for `https://app.bookiji.com/login`), magic links would otherwise open Bookiji
 * instead of this dev server. In that case we drop the pin and use `windowOrigin` only.
 *
 * @param isDev - pass `import.meta.env.DEV` from the client bundle
 */
export function resolveConfiguredAuthRedirectUrl(
  windowOrigin: string,
  configuredRedirectUrl: string | null | undefined,
  isDev: boolean
): string | null | undefined {
  if (!isDev) return configuredRedirectUrl
  const trimmed = configuredRedirectUrl?.trim() ?? ''
  if (!trimmed) return configuredRedirectUrl

  try {
    const win = new URL(windowOrigin)
    const cfg = new URL(trimmed)
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

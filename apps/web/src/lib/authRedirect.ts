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

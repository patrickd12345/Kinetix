/**
 * User-facing copy for Supabase Auth API failures (magic link, OAuth redirect, etc.).
 * Does not retry; maps rate limits to explicit guidance.
 */
export function formatSupabaseAuthError(error: unknown): string {
  const status = getErrorStatus(error)
  if (status === 429) {
    return 'Too many sign-in attempts. Please wait a minute before requesting another magic link.'
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'Sign-in failed. Please try again.'
}

function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const raw = (error as { status?: unknown }).status
    return typeof raw === 'number' ? raw : undefined
  }
  return undefined
}

type AnalyticsPayload = Record<string, unknown>

function getPosthogKey(): string | undefined {
  const env = import.meta.env as ImportMetaEnv & { readonly NEXT_PUBLIC_POSTHOG_KEY?: string }
  return env.VITE_POSTHOG_KEY ?? env.NEXT_PUBLIC_POSTHOG_KEY
}

function canTrack(): boolean {
  return Boolean(getPosthogKey())
}

export function track(eventName: string, payload: AnalyticsPayload = {}): void {
  if (!canTrack()) return

  // PostHog integration intentionally deferred; this is a zero-cost scaffold.
  void eventName
  void payload
}

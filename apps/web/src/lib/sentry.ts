import * as Sentry from '@sentry/react'

let initialized = false

function getDsn(): string | undefined {
  const env = import.meta.env as ImportMetaEnv & { readonly NEXT_PUBLIC_SENTRY_DSN?: string }
  return env.VITE_SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN
}

function getEnvironment(): string {
  const env = import.meta.env as ImportMetaEnv & { readonly NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string }
  return env.VITE_SENTRY_ENVIRONMENT ?? env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? env.SENTRY_ENVIRONMENT ?? env.MODE
}

export function initWebSentry(): void {
  if (initialized) return

  const dsn = getDsn()
  if (!dsn) return

  try {
    Sentry.init({
      dsn,
      enabled: true,
      environment: getEnvironment(),
      sampleRate: 0.1,
      tracesSampleRate: 0,
    })
    initialized = true
  } catch (error) {
    console.warn('[sentry] Failed to initialize web Sentry', error)
  }
}

export { Sentry }

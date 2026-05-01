import * as Sentry from '@sentry/node'
import type { VercelRequest, VercelResponse } from '@vercel/node'

let initialized = false

function getDsn(): string | undefined {
  return process.env.SENTRY_DSN
}

function getEnvironment(): string {
  return process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development'
}

export function initApiSentry(): void {
  if (initialized) return

  const dsn = getDsn()
  if (!dsn) return

  try {
    Sentry.init({
      dsn,
      environment: getEnvironment(),
      enabled: true,
      sampleRate: 0.1,
      tracesSampleRate: 0,
    })
    initialized = true
  } catch (error) {
    console.warn('[sentry] Failed to initialize API Sentry', error)
  }
}

export function captureApiException(error: unknown): void {
  if (!initialized) return
  try {
    Sentry.captureException(error)
  } catch {
    // Never break request flow because of telemetry.
  }
}

type ApiHandler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown

export function withSentryApiHandler(handler: ApiHandler): ApiHandler {
  return async (req, res) => {
    initApiSentry()
    try {
      await handler(req, res)
    } catch (error) {
      captureApiException(error)
      throw error
    }
  }
}

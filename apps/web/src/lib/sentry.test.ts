import { beforeEach, describe, expect, it, vi } from 'vitest'

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  ErrorBoundary: vi.fn(),
}))

vi.mock('@sentry/react', () => sentry)

async function loadWebSentryModule() {
  vi.resetModules()
  return import('./sentry')
}

describe('web sentry wrapper', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('does not initialize when browser DSNs are unset', async () => {
    const { initWebSentry } = await loadWebSentryModule()

    initWebSentry()

    expect(sentry.init).not.toHaveBeenCalled()
  })

  it('treats blank browser DSN values as disabled', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '   ')
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', ' ')
    const { initWebSentry } = await loadWebSentryModule()

    initWebSentry()

    expect(sentry.init).not.toHaveBeenCalled()
  })

  it('initializes once from the Vite DSN and environment', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.com/2')
    vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'preview')
    const { initWebSentry } = await loadWebSentryModule()

    initWebSentry()
    initWebSentry()

    expect(sentry.init).toHaveBeenCalledOnce()
    expect(sentry.init).toHaveBeenCalledWith({
      dsn: 'https://public@example.com/2',
      enabled: true,
      environment: 'preview',
      sampleRate: 0.1,
      tracesSampleRate: 0,
    })
  })

  it('fails closed when browser Sentry initialization throws', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.com/2')
    sentry.init.mockImplementationOnce(() => {
      throw new Error('sentry unavailable')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { initWebSentry } = await loadWebSentryModule()

    initWebSentry()

    expect(warn).toHaveBeenCalledWith('[sentry] Failed to initialize web Sentry', expect.any(Error))

    warn.mockRestore()
  })
})

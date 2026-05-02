import { beforeEach, describe, expect, it, vi } from 'vitest'

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock('@sentry/node', () => sentry)

async function loadSentryModule() {
  vi.resetModules()
  return import('./sentry.js')
}

describe('api sentry wrapper', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('does not initialize or capture when SENTRY_DSN is unset', async () => {
    const { captureApiException, withSentryApiHandler } = await loadSentryModule()
    const handler = vi.fn()

    await withSentryApiHandler(handler)({ method: 'GET' } as never, {} as never)
    captureApiException(new Error('ignored'))

    expect(handler).toHaveBeenCalledOnce()
    expect(sentry.init).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it('treats blank SENTRY_DSN values as disabled', async () => {
    vi.stubEnv('SENTRY_DSN', '   ')
    const { captureApiException, withSentryApiHandler } = await loadSentryModule()
    const handler = vi.fn()

    await withSentryApiHandler(handler)({ method: 'GET' } as never, {} as never)
    captureApiException(new Error('ignored'))

    expect(handler).toHaveBeenCalledOnce()
    expect(sentry.init).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it('initializes once and captures thrown handler errors when SENTRY_DSN is set', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://public@example.com/1')
    vi.stubEnv('SENTRY_ENVIRONMENT', 'production')
    const { withSentryApiHandler } = await loadSentryModule()
    const error = new Error('boom')
    const handler = vi.fn(() => {
      throw error
    })

    await expect(withSentryApiHandler(handler)({ method: 'GET' } as never, {} as never)).rejects.toThrow('boom')

    expect(sentry.init).toHaveBeenCalledWith({
      dsn: 'https://public@example.com/1',
      environment: 'production',
      enabled: true,
      sampleRate: 0.1,
      tracesSampleRate: 0,
    })
    expect(sentry.captureException).toHaveBeenCalledWith(error)
  })

  it('fails closed when Sentry initialization throws', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://public@example.com/1')
    sentry.init.mockImplementationOnce(() => {
      throw new Error('sentry unavailable')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { captureApiException, withSentryApiHandler } = await loadSentryModule()
    const handler = vi.fn()

    await withSentryApiHandler(handler)({ method: 'GET' } as never, {} as never)
    captureApiException(new Error('ignored'))

    expect(handler).toHaveBeenCalledOnce()
    expect(sentry.captureException).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('[sentry] Failed to initialize API Sentry', expect.any(Error))

    warn.mockRestore()
  })
})

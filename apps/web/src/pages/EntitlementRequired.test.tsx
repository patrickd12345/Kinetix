import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthContextValue } from '../components/providers/useAuth'
import { AuthContext } from '../components/providers/useAuth'
import EntitlementRequired from './EntitlementRequired'

function createAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'forbidden',
    session: { access_token: 'token-1', user: { id: 'u1' } } as AuthContextValue['session'],
    profile: null,
    error: null,
    sendMagicLink: async () => {},
    signInWithOAuth: async () => {},
    oauthProviders: { google: false, apple: false, microsoft: false },
    signOut: async () => {},
    refresh: async () => {},
    ...overrides,
  }
}

describe('EntitlementRequired checkout CTA', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects to Stripe checkout on success', async () => {
    const assignSpy = vi.fn()
    // Best-effort: make assign testable in jsdom.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubGlobal('location', { ...window.location, origin: 'http://localhost', assign: assignSpy } as any)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://checkout.stripe.test/session' }), { status: 200 }),
    )

    render(
      <AuthContext.Provider value={createAuthValue()}>
        <EntitlementRequired />
      </AuthContext.Provider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Continue to checkout' }))
    expect(assignSpy).toHaveBeenCalledWith('https://checkout.stripe.test/session')
  })

  it('shows loading state and inline error on failure', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubGlobal('location', { ...window.location, origin: 'http://localhost' } as any)

    let resolveFetch: ((value: Response) => void) | null = null
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    vi.spyOn(globalThis, 'fetch').mockReturnValue(fetchPromise)

    render(
      <AuthContext.Provider value={createAuthValue()}>
        <EntitlementRequired />
      </AuthContext.Provider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Continue to checkout' }))
    expect(screen.getByRole('button', { name: 'Starting checkout...' })).toBeDisabled()

    resolveFetch?.(new Response(JSON.stringify({}), { status: 503 }))
    expect(await screen.findByText(/Billing is temporarily unavailable/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to checkout' })).not.toBeDisabled()
  })

  it('renders unauthorized error deterministically when access token is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubGlobal('location', { ...window.location, origin: 'http://localhost' } as any)

    const auth = createAuthValue({ session: null })
    render(
      <AuthContext.Provider value={auth}>
        <EntitlementRequired />
      </AuthContext.Provider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Continue to checkout' }))
    expect(await screen.findByText(/must be signed in/i)).toBeInTheDocument()
  })
})

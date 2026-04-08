import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { AuthProvider } from '../components/providers/AuthProvider'

const mockState = vi.hoisted(() => {
  const state = {
    session: null as { user: { id: string; email?: string } } | null,
    profile: null as Record<string, unknown> | null,
    entitlements: [] as Array<Record<string, unknown>>,
    onAuthChange: null as ((event: string, session: { user: { id: string; email?: string } } | null) => void) | null,
  }

  const supabase = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: state.session }, error: null })),
      onAuthStateChange: vi.fn((callback: (event: string, session: { user: { id: string; email?: string } } | null) => void) => {
        state.onAuthChange = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      signInWithOtp: vi.fn(async () => {
        return { data: { session: null }, error: null }
      }),
      signInWithOAuth: vi.fn(async () => {
        return { data: { provider: 'google', url: 'https://example.com' }, error: null }
      }),
      signOut: vi.fn(async () => {
        state.session = null
        return { error: null }
      }),
    },
    schema: vi.fn(() => ({
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: state.profile, error: null }),
              }),
            }),
          }
        }
        if (table === 'entitlements') {
          return {
            select: () => ({
              eq: async () => ({ data: state.entitlements, error: null }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      },
    })),
  }

  return { state, supabase }
})

vi.mock('../lib/supabaseClient', () => ({
  supabase: mockState.supabase,
}))

describe('Supabase auth and entitlement gating', () => {
  beforeEach(() => {
    mockState.state.session = null
    mockState.state.profile = null
    mockState.state.entitlements = []
    mockState.state.onAuthChange = null
    vi.clearAllMocks()
  })

  it('sends a magic link through Supabase auth', async () => {
    window.history.pushState({}, '', '/login')
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    )

    await userEvent.type(screen.getByLabelText('Email'), 'runner@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))

    await waitFor(() => {
      expect(mockState.supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'runner@example.com',
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining('/login'),
        }),
      })
    })
  })

  it('allows protected route access with active kinetix entitlement', async () => {
    mockState.state.session = { user: { id: 'profile-1', email: 'runner@example.com' } }
    mockState.state.profile = { id: 'profile-1', display_name: 'Runner One' }
    mockState.state.entitlements = [{ product_key: 'kinetix', status: 'active', active: true }]

    window.history.pushState({}, '', '/chat')
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    )

    expect(await screen.findByText('Coach chat')).toBeInTheDocument()
  })

  it('blocks access when kinetix entitlement is missing', async () => {
    mockState.state.session = { user: { id: 'profile-1', email: 'runner@example.com' } }
    mockState.state.profile = { id: 'profile-1', display_name: 'Runner One' }
    mockState.state.entitlements = [{ product_key: 'bookiji', status: 'active', active: true }]

    window.history.pushState({}, '', '/chat')
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    )

    expect(await screen.findByText('Entitlement required')).toBeInTheDocument()
  })
})

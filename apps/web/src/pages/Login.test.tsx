import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

const sendMagicLink = vi.fn()
const signInWithOAuth = vi.fn()

vi.mock('../components/providers/useAuth', () => ({
  useAuth: () => ({
    status: 'unauthenticated' as const,
    session: null,
    profile: null,
    error: null,
    sendMagicLink,
    signInWithOAuth,
    oauthProviders: { google: false, apple: false, microsoft: false },
    signOut: vi.fn(),
    refresh: vi.fn(),
  }),
}))

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendMagicLink.mockImplementation(() => new Promise(() => {}))
  })

  it('does not send duplicate magic link requests on rapid submit', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>
    )

    await userEvent.type(screen.getByLabelText('Email'), 'runner@example.com')

    const button = screen.getByRole('button', { name: 'Send magic link' })
    await userEvent.click(button)
    await userEvent.click(button)
    await userEvent.click(button)

    expect(sendMagicLink).toHaveBeenCalledTimes(1)
  })
})

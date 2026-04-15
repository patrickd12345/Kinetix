import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { PlatformProfileRecord } from '../../lib/kinetixProfile'

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'forbidden' | 'error'
export type OAuthProvider = 'google' | 'apple' | 'microsoft'

export interface OAuthProviderAvailability {
  google: boolean
  apple: boolean
  microsoft: boolean
}

export interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  profile: PlatformProfileRecord | null
  error: string | null
  sendMagicLink: (email: string, nextPath?: string) => Promise<void>
  signInWithOAuth: (provider: OAuthProvider, nextPath?: string) => Promise<void>
  oauthProviders: OAuthProviderAvailability
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

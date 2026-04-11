import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, SUPABASE_CONFIG_ERROR } from '../../lib/supabaseClient'
import {
  fetchPlatformProfile,
  hasActiveEntitlementForUser,
  KINETIX_PRODUCT_KEY,
} from '../../lib/platformAuth'
import type { PlatformProfileRecord } from '../../lib/kinetixProfile'
import { setActivePlatformProfile } from '../../lib/authState'
import { buildAuthRedirectTarget, resolveConfiguredAuthRedirectUrl } from '../../lib/authRedirect'
import { formatSupabaseAuthError } from '../../lib/supabaseAuthErrors'
import { AuthContext, type AuthContextValue, type OAuthProviderAvailability } from './useAuth'

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'forbidden' | 'error'

interface ResolveAccessResult {
  status: Exclude<AuthStatus, 'loading'>
  profile: PlatformProfileRecord | null
  error: string | null
}

async function resolveAccess(userId: string): Promise<ResolveAccessResult> {
  if (!supabase) throw new Error(SUPABASE_CONFIG_ERROR)
  const profile = await fetchPlatformProfile(supabase, userId)

  if (!profile) {
    setActivePlatformProfile(null)
    return {
      status: 'error',
      profile: null,
      error: 'Platform profile not found for this user.',
    }
  }

  setActivePlatformProfile(profile)
  const entitled = await hasActiveEntitlementForUser(
    supabase,
    profile.id,
    KINETIX_PRODUCT_KEY,
    userId
  )
  if (!entitled) {
    return {
      status: 'forbidden',
      profile,
      error: null,
    }
  }

  return {
    status: 'authenticated',
    profile,
    error: null,
  }
}

const SKIP_AUTH = import.meta.env.VITE_SKIP_AUTH === '1' || import.meta.env.VITE_SKIP_AUTH === 'true'
const OAUTH_PROVIDERS: OAuthProviderAvailability = {
  google:
    import.meta.env.VITE_AUTH_GOOGLE_ENABLED === '1' ||
    import.meta.env.VITE_AUTH_GOOGLE_ENABLED === 'true',
  apple:
    import.meta.env.VITE_AUTH_APPLE_ENABLED === '1' ||
    import.meta.env.VITE_AUTH_APPLE_ENABLED === 'true',
  microsoft:
    import.meta.env.VITE_AUTH_MICROSOFT_ENABLED === '1' ||
    import.meta.env.VITE_AUTH_MICROSOFT_ENABLED === 'true',
}
const AUTH_REDIRECT_URL =
  import.meta.env.VITE_AUTH_REDIRECT_URL ??
  import.meta.env.NEXT_PUBLIC_AUTH_REDIRECT_URL ??
  null

function authRedirectUrlForCurrentWindow(): string | null | undefined {
  if (typeof window === 'undefined') return AUTH_REDIRECT_URL
  return resolveConfiguredAuthRedirectUrl(
    window.location.origin,
    AUTH_REDIRECT_URL,
    import.meta.env.DEV
  )
}

const MOCK_BYPASS_PROFILE: PlatformProfileRecord = {
  id: 'bypass-dev',
  display_name: 'Dev (no auth)',
  email: null,
  full_name: null,
  age: 30,
  weight_kg: 70,
  metadata: null,
}

/** Lets operator views call `/api/support-queue/*` with Authorization in E2E and local smoke runs. */
const SKIP_AUTH_SESSION = {
  access_token: 'vite-skip-auth-bypass',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: '',
  user: {
    id: 'bypass-dev',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'dev@local',
    phone: '',
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  },
} as Session

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<PlatformProfileRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const magicLinkInFlight = useRef(false)
  const oauthRedirectInFlight = useRef(false)

  useEffect(() => {
    if (SKIP_AUTH) {
      setStatus('authenticated')
      setSession(SKIP_AUTH_SESSION)
      setProfile(MOCK_BYPASS_PROFILE)
      setError(null)
      setActivePlatformProfile(MOCK_BYPASS_PROFILE)
    }
  }, [])

  const hydrateFromSession = useCallback(async (currentSession: Session | null) => {
    if (SKIP_AUTH) return
    if (!currentSession) {
      setSession(null)
      setProfile(null)
      setError(null)
      setStatus('unauthenticated')
      setActivePlatformProfile(null)
      return
    }

    setSession(currentSession)
    setStatus('loading')
    try {
      const access = await resolveAccess(currentSession.user.id)
      setProfile(access.profile)
      setError(access.error)
      setStatus(access.status)
    } catch (err) {
      setProfile(null)
      setError(err instanceof Error ? err.message : 'Authentication failed.')
      setStatus('error')
      setActivePlatformProfile(null)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!supabase) return
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      setStatus('error')
      setError(sessionError.message)
      return
    }
    await hydrateFromSession(data.session)
  }, [hydrateFromSession])

  useEffect(() => {
    if (SKIP_AUTH) return
    if (!supabase) {
      setStatus('error')
      setError(SUPABASE_CONFIG_ERROR)
      return
    }
    const client = supabase
    let mounted = true
    const init = async () => {
      const { data, error: sessionError } = await client.auth.getSession()
      if (!mounted) return
      if (sessionError) {
        setStatus('error')
        setError(sessionError.message)
        return
      }
      await hydrateFromSession(data.session)
    }

    init()
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      void hydrateFromSession(nextSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [hydrateFromSession])

  const sendMagicLink = useCallback(async (email: string, nextPath?: string) => {
    if (!supabase) throw new Error(SUPABASE_CONFIG_ERROR)
    if (magicLinkInFlight.current) {
      throw new Error('A magic link request is already in progress. Please wait.')
    }
    magicLinkInFlight.current = true
    const redirectTarget = buildAuthRedirectTarget({
      windowOrigin: window.location.origin,
      configuredRedirectUrl: authRedirectUrlForCurrentWindow(),
      nextPath,
    })
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTarget,
        },
      })
      if (otpError) throw otpError
    } catch (err) {
      throw new Error(formatSupabaseAuthError(err))
    } finally {
      magicLinkInFlight.current = false
    }
  }, [])

  const signInWithOAuth = useCallback(
    async (provider: 'google' | 'apple' | 'microsoft', nextPath?: string) => {
      if (!supabase) throw new Error(SUPABASE_CONFIG_ERROR)
      if (oauthRedirectInFlight.current) {
        throw new Error('A sign-in redirect is already in progress. Please wait.')
      }
      oauthRedirectInFlight.current = true
      const redirectTarget = buildAuthRedirectTarget({
        windowOrigin: window.location.origin,
        configuredRedirectUrl: authRedirectUrlForCurrentWindow(),
        nextPath,
      })
      const providerKey = provider === 'microsoft' ? 'azure' : provider
      try {
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: providerKey,
          options: { redirectTo: redirectTarget },
        })
        if (oauthError) throw oauthError
      } catch (err) {
        throw new Error(formatSupabaseAuthError(err))
      } finally {
        oauthRedirectInFlight.current = false
      }
    },
    []
  )

  const signOut = useCallback(async () => {
    if (SKIP_AUTH) return
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) throw signOutError
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      profile,
      error,
      sendMagicLink,
      signInWithOAuth,
      oauthProviders: OAUTH_PROVIDERS,
      signOut,
      refresh,
    }),
    [status, session, profile, error, sendMagicLink, signInWithOAuth, signOut, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

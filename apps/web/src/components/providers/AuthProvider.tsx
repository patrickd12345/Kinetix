import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, SUPABASE_CONFIG_ERROR } from '../../lib/supabaseClient'
import {
  fetchPlatformProfile,
  hasActiveEntitlementForUser,
  KINETIX_PRODUCT_KEY,
} from '../../lib/platformAuth'
import type { PlatformProfileRecord } from '../../lib/kinetixProfile'
import { setActivePlatformProfile } from '../../lib/authState'
import { AuthContext, type AuthContextValue } from './useAuth'

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

const MOCK_BYPASS_PROFILE: PlatformProfileRecord = {
  id: 'bypass-dev',
  display_name: 'Dev (no auth)',
  email: null,
  full_name: null,
  age: 30,
  weight_kg: 70,
  metadata: null,
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<PlatformProfileRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (SKIP_AUTH) {
      setStatus('authenticated')
      setSession(null)
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

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(SUPABASE_CONFIG_ERROR)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(SUPABASE_CONFIG_ERROR)
    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) throw signUpError
  }, [])

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
      signInWithPassword,
      signUp,
      signOut,
      refresh,
    }),
    [status, session, profile, error, signInWithPassword, signUp, signOut, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

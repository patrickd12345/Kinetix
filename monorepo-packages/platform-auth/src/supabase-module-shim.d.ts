/**
 * Minimal module contract for `tsc`/`tsup` DTS when `@supabase/supabase-js` is not
 * materialized under `packages/platform-auth/node_modules` (umbrella Vercel build).
 * Runtime still resolves the real package via `package.json` → app `node_modules`.
 */
declare module '@supabase/supabase-js' {
  export interface User {
    id: string
    email?: string | undefined
  }

  export interface Session {
    access_token: string
    refresh_token: string
  }

  export interface SupabaseAuthAdminApi {
    listUsers: () => Promise<{ data: { users: User[] | null } | null }>
    updateUserById: (id: string, attrs: { password?: string }) => Promise<unknown>
    createUser: (args: {
      email: string
      password: string
      email_confirm?: boolean
      user_metadata?: Record<string, unknown>
    }) => Promise<{ data: { user: User | null } | null; error: { message?: string } | null }>
  }

  export interface SupabaseClient {
    auth: {
      signInWithPassword: (credentials: {
        email: string
        password: string
      }) => Promise<{ data: { session: Session | null } | null; error: { message?: string } | null }>
      admin: SupabaseAuthAdminApi
    }
  }

  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: { auth?: { autoRefreshToken?: boolean; persistSession?: boolean } },
  ): SupabaseClient
}

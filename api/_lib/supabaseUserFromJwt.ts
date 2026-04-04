/**
 * Validate a Supabase JWT using the Auth REST API (avoids TS mismatches on
 * SupabaseAuthClient.getUser across @supabase/ssr / supabase-js versions).
 */
export async function getSupabaseUserFromJwt(
  supabaseUrl: string,
  anonKey: string,
  jwt: string,
): Promise<{ id: string; email: string | null } | null> {
  const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: anonKey,
    },
  })
  if (!res.ok) return null
  const body = (await res.json()) as { id?: string; email?: string | null }
  if (!body?.id) return null
  return { id: body.id, email: body.email ?? null }
}

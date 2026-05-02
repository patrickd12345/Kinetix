import { supabase } from './supabaseClient'

export async function getSessionAuthHeaders(): Promise<Record<string, string>> {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}


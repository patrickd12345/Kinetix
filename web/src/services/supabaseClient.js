import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let client = null

export function getSupabaseClient() {
  if (!url || !anonKey) return null
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
      },
    })
  }
  return client
}

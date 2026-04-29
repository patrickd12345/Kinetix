import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { vitePluginOAuth } from './vite-plugin-oauth'
import { sharedViteConfig } from './vite.config.shared'

/**
 * When the parent process injects secrets (e.g. `pnpm dev` → Infisical merge → `concurrently`),
 * those variables live on `process.env` but are not always merged into the client `import.meta.env`
 * the same way as `apps/web/.env.local`. Forward Supabase (and related) keys explicitly so
 * `supabaseClient.ts` sees URL + anon/publishable key in the browser bundle.
 */
function defineImportMetaEnvFromProcess(keys: readonly string[]): Record<string, string> {
  const define: Record<string, string> = {}
  for (const key of keys) {
    const raw = process.env[key]
    if (raw !== undefined && raw !== '') {
      define[`import.meta.env.${key}`] = JSON.stringify(raw)
    }
  }
  return define
}

const DEV_FORWARD_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const

/** Local dev only: OAuth + `/api/ai-chat` middleware (needs umbrella `packages/` links). */
export default defineConfig({
  ...sharedViteConfig(),
  define: defineImportMetaEnvFromProcess(DEV_FORWARD_ENV_KEYS),
  plugins: [react(), vitePluginOAuth()],
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sharedViteConfig } from './vite.config.shared'

/**
 * Default for `vite build` / Vercel — must not import `vite-plugin-oauth` (pulls in
 * `api/_lib` and `@bookiji-inc/*`, which are monorepo-only). Local dev uses
 * `vite.config.dev.ts` via `pnpm dev`.
 */
export default defineConfig({
  ...sharedViteConfig(),
  plugins: [react()],
})

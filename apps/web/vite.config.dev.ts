import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { vitePluginOAuth } from './vite-plugin-oauth'
import { sharedViteConfig } from './vite.config.shared'

/** Local dev only: OAuth + `/api/ai-chat` middleware (needs umbrella `packages/` links). */
export default defineConfig({
  ...sharedViteConfig(),
  plugins: [react(), vitePluginOAuth()],
})

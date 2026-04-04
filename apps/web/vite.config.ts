import { defineConfig } from 'vite'
import type { Plugin, UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * `vite-plugin-oauth` pulls in `api/_lib/ai/*` and `@bookiji-inc/*` (monorepo links).
 * Vercel builds only the Kinetix repo — those packages are not on disk — so the config
 * bundle must not statically import that plugin.
 *
 * - Vercel sets `VERCEL=1` automatically.
 * - Use `KINETIX_SKIP_VITE_DEV_API=1` in other CI without umbrella `packages/`.
 *
 * Production API routes live under `api/` (serverless); dev-only OAuth + local AI middleware
 * are omitted from the Vercel `vite build` graph on purpose.
 */
function skipViteDevApiPlugin(): boolean {
  return process.env.VERCEL === '1' || process.env.KINETIX_SKIP_VITE_DEV_API === '1'
}

export default defineConfig(async (): Promise<UserConfig> => {
  const plugins: Plugin[] = [react()]
  if (!skipViteDevApiPlugin()) {
    const { vitePluginOAuth } = await import('./vite-plugin-oauth')
    plugins.push(vitePluginOAuth())
  }

  return {
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    envDir: __dirname,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      open: true,
      proxy: {
        '/api/strava': {
          target: 'https://www.strava.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/strava/, '/api/v3'),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              Object.keys(proxyReq.getHeaders()).forEach((key) => {
                proxyReq.removeHeader(key)
              })

              const authHeader = req.headers.authorization || req.headers.Authorization
              if (authHeader) {
                proxyReq.setHeader('Authorization', authHeader)
              }

              proxyReq.setHeader('Host', 'www.strava.com')
              proxyReq.setHeader('User-Agent', 'Kinetix/1.0')
            })
          },
        },
      },
    },
  }
})

import path from 'path'
import { fileURLToPath } from 'url'
import type { UserConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Shared between `vite.config.ts` (build) and `vite.config.dev.ts` (local dev). */
export function sharedViteConfig(): Pick<UserConfig, 'envPrefix' | 'envDir' | 'resolve' | 'server'> {
  return {
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
          rewrite: (p) => p.replace(/^\/api\/strava/, '/api/v3'),
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
}

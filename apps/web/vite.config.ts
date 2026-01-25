import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
            // Remove all headers first to avoid forwarding cookies and other large headers
            Object.keys(proxyReq.getHeaders()).forEach((key) => {
              proxyReq.removeHeader(key)
            })
            
            // Only forward the Authorization header explicitly
            const authHeader = req.headers.authorization || req.headers.Authorization
            if (authHeader) {
              proxyReq.setHeader('Authorization', authHeader)
            }
            
            // Set minimal required headers
            proxyReq.setHeader('Host', 'www.strava.com')
            proxyReq.setHeader('User-Agent', 'Kinetix/1.0')
          })
        },
      },
    },
  },
})

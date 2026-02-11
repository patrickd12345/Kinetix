import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import { loadEnv } from 'vite'

// Import the OAuth handler logic
async function handleOAuthRequest(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  let body = ''
  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', async () => {
    try {
      const { code, redirect_uri } = JSON.parse(body)

      if (!code) {
        // #region agent log
        console.error('[OAuth Local] Missing authorization code')
        // #endregion
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Authorization code required' }))
        return
      }

      // Get client secret from environment variable
      const clientSecret = env.STRAVA_CLIENT_SECRET || process.env.STRAVA_CLIENT_SECRET
      const clientId = env.STRAVA_CLIENT_ID || process.env.STRAVA_CLIENT_ID || '157217'

      if (!clientSecret) {
        console.error('[OAuth Local] STRAVA_CLIENT_SECRET not configured')
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Server configuration error: STRAVA_CLIENT_SECRET not set. Please set it in your .env.local file.' }))
        return
      }

      const tokenExchangeUrl = 'https://www.strava.com/oauth/token'
      const tokenExchangeBody = {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirect_uri || `${req.headers.origin}/settings`,
      }

      const response = await fetch(tokenExchangeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tokenExchangeBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[OAuth Local] Strava token exchange error:', errorData)
        res.writeHead(response.status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          error: 'Failed to exchange authorization code',
          details: errorData,
        }))
        return
      }

      const data = await response.json()


      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
      }))
    } catch (error) {
      console.error('[OAuth Local] Token exchange error:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: 'Failed to exchange authorization code',
        message: error instanceof Error ? error.message : 'Unknown error',
      }))
    }
  })
}

export function vitePluginOAuth(): Plugin {
  return {
    name: 'vite-plugin-oauth',
    configureServer(server) {
      // Load environment variables from .env.local
      // Use Vite's root config which should be the web app directory
      const envDir = server.config.envDir || server.config.root || __dirname
      const env = loadEnv(server.config.mode, envDir, '')
      
      // Also check process.env as fallback (for when vars are set in shell)
      const mergedEnv = {
        ...process.env,
        ...env,
      }
      
      server.middlewares.use('/api/strava-oauth', (req, res, next) => {
        handleOAuthRequest(req, res, mergedEnv).catch(next)
      })
    },
  }
}

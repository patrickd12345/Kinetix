import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import { loadEnv } from 'vite'
import crypto from 'node:crypto'

const WITHINGS_API = 'https://wbsapi.withings.net'

function withingsHmac(key: string, message: string): string {
  return crypto.createHmac('sha256', key).update(message, 'utf8').digest('base64')
}

async function withingsGetNonce(clientId: string, clientSecret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000)
  const toSign = ['getnonce', clientId, String(timestamp)].join(',')
  const signature = withingsHmac(clientSecret, toSign)
  const body = new URLSearchParams({ action: 'getnonce', client_id: clientId, timestamp: String(timestamp), signature })
  const res = await fetch(`${WITHINGS_API}/v2/signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Withings getnonce: ${res.status}`)
  const data = await res.json()
  const nonce = data?.body?.nonce
  if (!nonce) throw new Error('Withings getnonce: no nonce')
  return nonce
}

async function withingsRequestToken(
  clientId: string,
  clientSecret: string,
  bodyParams: Record<string, string>
): Promise<{ access_token: string; refresh_token: string; userid: number; expires_in: number }> {
  const nonce = await withingsGetNonce(clientId, clientSecret)
  const signature = withingsHmac(clientSecret, ['requesttoken', clientId, nonce].join(','))
  const body = new URLSearchParams({ ...bodyParams, nonce, signature })
  const res = await fetch(`${WITHINGS_API}/v2/oauth2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Withings requesttoken: ${res.status}`)
  const data = await res.json()
  if (data?.status !== 0 || !data?.body?.access_token) throw new Error(data?.body?.error ?? 'Withings token error')
  return {
    access_token: data.body.access_token,
    refresh_token: data.body.refresh_token,
    userid: data.body.userid ?? 0,
    expires_in: typeof data.body.expires_in === 'number' ? data.body.expires_in : 3 * 3600,
  }
}

async function handleWithingsOAuthRequest(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
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
  req.on('data', (chunk) => { body += chunk.toString() })
  req.on('end', async () => {
    try {
      const { code, redirect_uri } = JSON.parse(body)
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Authorization code required' }))
        return
      }
      const clientId = env.VITE_WITHINGS_CLIENT_ID || env.WITHINGS_CLIENT_ID || process.env.VITE_WITHINGS_CLIENT_ID || process.env.WITHINGS_CLIENT_ID
      const clientSecret = env.WITHINGS_CLIENT_SECRET || process.env.WITHINGS_CLIENT_SECRET
      const redirectUri = redirect_uri || `${req.headers.origin || 'http://localhost:5173'}/settings`
      if (!clientId || !clientSecret) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Withings not configured. Set VITE_WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET in .env.local' }))
        return
      }
      const result = await withingsRequestToken(clientId, clientSecret, {
        action: 'requesttoken',
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        grant_type: 'authorization_code',
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        userid: result.userid,
        expires_in: result.expires_in,
      }))
    } catch (e) {
      console.error('[OAuth Local] Withings', e)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Withings OAuth failed' }))
    }
  })
}

async function handleWithingsRefreshRequest(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
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
  req.on('data', (chunk) => { body += chunk.toString() })
  req.on('end', async () => {
    try {
      const { refresh_token } = JSON.parse(body)
      if (!refresh_token) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'refresh_token required' }))
        return
      }
      const clientId = env.VITE_WITHINGS_CLIENT_ID || env.WITHINGS_CLIENT_ID || process.env.VITE_WITHINGS_CLIENT_ID || process.env.WITHINGS_CLIENT_ID
      const clientSecret = env.WITHINGS_CLIENT_SECRET || process.env.WITHINGS_CLIENT_SECRET
      if (!clientId || !clientSecret) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Withings not configured' }))
        return
      }
      const result = await withingsRequestToken(clientId, clientSecret, {
        action: 'requesttoken',
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        userid: result.userid,
        expires_in: result.expires_in,
      }))
    } catch (e) {
      console.error('[OAuth Local] Withings refresh', e)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Withings refresh failed' }))
    }
  })
}

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
      server.middlewares.use('/api/withings-oauth', (req, res, next) => {
        handleWithingsOAuthRequest(req, res, mergedEnv).catch(next)
      })
      server.middlewares.use('/api/withings-refresh', (req, res, next) => {
        handleWithingsRefreshRequest(req, res, mergedEnv).catch(next)
      })
    },
  }
}

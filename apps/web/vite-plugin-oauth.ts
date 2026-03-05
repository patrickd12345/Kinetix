import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import { loadEnv } from 'vite'
import { getByokDecision, mustReject, readByokHeader } from '../../api/_lib/ai/byok'
import { getLLMClient } from '../../api/_lib/ai/llmClient'
import { withingsRequestToken } from './src/lib/withingsOAuthServer'

async function handleAiChat(
  body: { systemInstruction?: string; contents?: unknown[] },
  headers: Record<string, string | string[] | undefined>
): Promise<{ text: string } | { error: string }> {
  const byokKey = readByokHeader(headers)
  const decision = getByokDecision('ai-chat', byokKey)
  if (mustReject(decision)) {
    return { error: 'BYOK is not supported on this endpoint.' }
  }
  const { systemInstruction, contents } = body
  if (!systemInstruction || !contents) {
    return { error: 'systemInstruction and contents are required.' }
  }
  const userContent = Array.isArray(contents)
    ? contents
        .map((c: { parts?: { text?: string }[] }) =>
          Array.isArray(c?.parts)
            ? c.parts.map((p) => p?.text || '').join('\n').trim()
            : ''
        )
        .filter(Boolean)
        .join('\n\n')
    : ''
  const client = getLLMClient()
  const { text } = await client.executeChat(
    [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userContent || 'Respond concisely.' },
    ],
    { temperature: 0.7, maxTokens: 1024 }
  )
  return { text: text?.trim() || '' }
}

async function handleAiCoach(
  body: { prompt?: string },
  headers: Record<string, string | string[] | undefined>
): Promise<{ text: string } | { error: string }> {
  const byokKey = readByokHeader(headers)
  const decision = getByokDecision('ai-coach', byokKey)
  if (mustReject(decision)) {
    return { error: 'BYOK is not supported on this endpoint.' }
  }
  const prompt = body?.prompt
  if (!prompt || typeof prompt !== 'string') {
    return { error: 'prompt is required.' }
  }
  const client = getLLMClient()
  const { text } = await client.executeChat(
    [
      { role: 'system', content: 'You are a concise running coach.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.7, maxTokens: 400 }
  )
  return { text: text?.trim() || '' }
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
      const redirectUri = (redirect_uri || `${req.headers.origin || 'http://localhost:5173'}/settings`).replace(/\/$/, '')
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
      const message = e instanceof Error ? e.message : 'Withings OAuth failed'
      const isServiceUnavailable = message.includes('temporarily unavailable')
      if (isServiceUnavailable) {
        console.warn('[OAuth Local] Withings:', message)
      } else {
        console.error('[OAuth Local] Withings', message, e)
      }
      const status = message.includes('not configured') || message.includes('required') ? 500 : isServiceUnavailable ? 503 : 400
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: message }))
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
      const message = e instanceof Error ? e.message : 'Withings refresh failed'
      const isServiceUnavailable = message.includes('temporarily unavailable')
      if (isServiceUnavailable) {
        console.warn('[OAuth Local] Withings refresh:', message)
      } else {
        console.error('[OAuth Local] Withings refresh', e)
      }
      res.writeHead(isServiceUnavailable ? 503 : 500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: message }))
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

async function handleStravaRefreshRequest(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
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
      const { refresh_token } = JSON.parse(body || '{}')
      if (!refresh_token) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'refresh_token required' }))
        return
      }
      const clientSecret = env.STRAVA_CLIENT_SECRET || process.env.STRAVA_CLIENT_SECRET
      const clientId = env.STRAVA_CLIENT_ID || process.env.STRAVA_CLIENT_ID || '157217'
      if (!clientSecret) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Strava not configured. Set STRAVA_CLIENT_SECRET.' }))
        return
      }
      const refreshRes = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token,
        }),
      })
      if (!refreshRes.ok) {
        const errData = await refreshRes.json().catch(() => ({}))
        res.writeHead(refreshRes.status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: errData.message || 'Strava refresh failed' }))
        return
      }
      const data = await refreshRes.json()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
      }))
    } catch (e) {
      console.error('[OAuth Local] Strava refresh', e)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Strava refresh failed' }))
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
      server.middlewares.use('/api/strava-refresh', (req, res, next) => {
        handleStravaRefreshRequest(req, res, mergedEnv).catch(next)
      })
      server.middlewares.use('/api/withings-oauth', (req, res, next) => {
        handleWithingsOAuthRequest(req, res, mergedEnv).catch(next)
      })
      server.middlewares.use('/api/withings-refresh', (req, res, next) => {
        handleWithingsRefreshRequest(req, res, mergedEnv).catch(next)
      })

      server.middlewares.use('/api/ai-chat', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-openai-key')
        if (req.method === 'OPTIONS') {
          res.writeHead(200).end()
          return
        }
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        let body = ''
        req.on('data', (chunk) => { body += chunk.toString() })
        req.on('end', () => {
          let parsed: { systemInstruction?: string; contents?: unknown[] }
          try {
            parsed = body ? (JSON.parse(body) as { systemInstruction?: string; contents?: unknown[] }) : {}
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Invalid JSON body' }))
            return
          }
          Object.assign(process.env, mergedEnv)
          const headers: Record<string, string | string[] | undefined> = {}
          for (const [k, v] of Object.entries(req.headers)) {
            if (v !== undefined) headers[k.toLowerCase()] = v
          }
          handleAiChat(parsed, headers)
            .then((out) => {
              if ('error' in out) {
                res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify(out))
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out))
              }
            })
            .catch((err: Error & { status?: number }) => {
              console.error('[vite api] ai-chat', err)
              const message = err?.message || 'Failed to complete AI request.'
              res.writeHead(err?.status ?? 500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: message }))
            })
        })
      })
      server.middlewares.use('/api/ai-coach', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-openai-key')
        if (req.method === 'OPTIONS') {
          res.writeHead(200).end()
          return
        }
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        let body = ''
        req.on('data', (chunk) => { body += chunk.toString() })
        req.on('end', () => {
          let parsed: { prompt?: string }
          try {
            parsed = body ? (JSON.parse(body) as { prompt?: string }) : {}
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Invalid JSON body' }))
            return
          }
          Object.assign(process.env, mergedEnv)
          const headers: Record<string, string | string[] | undefined> = {}
          for (const [k, v] of Object.entries(req.headers)) {
            if (v !== undefined) headers[k.toLowerCase()] = v
          }
          handleAiCoach(parsed, headers)
            .then((out) => {
              if ('error' in out) {
                res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify(out))
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out))
              }
            })
            .catch((err: Error & { status?: number }) => {
              console.error('[vite api] ai-coach', err)
              const message = err?.message || 'Failed to complete AI request.'
              res.writeHead(err?.status ?? 500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: message }))
            })
        })
      })
    },
  }
}

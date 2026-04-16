import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import { loadEnv } from 'vite'
import { adaptNodeResponseToVercel } from '../../api/_lib/nodeVercelResponse'
import { handleAiChatRequest, handleAiCoachRequest } from '../../api/_lib/ai/requestHandlers'
import {
  exchangeStravaCodeForToken,
  refreshStravaAccessToken,
  StravaAuthError,
} from '../../api/_lib/stravaAuth'
import { resolveWithingsRedirectUriForTokenExchange } from '../../api/_lib/withingsRedirectUri'
import { withingsRequestToken } from './src/lib/withingsOAuthServer'

type EnvMap = Record<string, string>
type HeaderMap = Record<string, string | string[] | undefined>

function setCors(res: ServerResponse, methods: string, headers: string): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', headers)
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function getEnvValue(env: EnvMap, ...keys: string[]): string {
  for (const key of keys) {
    const value = env[key] || process.env[key]
    if (value) return value
  }
  return ''
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

async function readJsonBody<T>(req: IncomingMessage, res: ServerResponse): Promise<T | null> {
  const body = await readBody(req)
  try {
    return (body ? JSON.parse(body) : {}) as T
  } catch {
    json(res, 400, { error: 'Invalid JSON body' })
    return null
  }
}

function toHeaderMap(req: IncomingMessage): HeaderMap {
  const headers: HeaderMap = {}
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) headers[k.toLowerCase()] = v
  }
  return headers
}

function handlePreflightAndMethod(
  req: IncomingMessage,
  res: ServerResponse,
  expectedMethod: 'POST' | 'GET' = 'POST'
): boolean {
  if (req.method === 'OPTIONS') {
    res.writeHead(200).end()
    return true
  }
  if (req.method !== expectedMethod) {
    json(res, 405, { error: 'Method not allowed' })
    return true
  }
  return false
}

async function handleWithingsOAuthRequest(req: IncomingMessage, res: ServerResponse, env: EnvMap) {
  setCors(res, 'POST, OPTIONS', 'Content-Type')
  if (handlePreflightAndMethod(req, res)) return

  const payload = await readJsonBody<{ code?: string; redirect_uri?: string }>(req, res)
  if (!payload) return
  const { code, redirect_uri } = payload
  if (!code) {
    json(res, 400, { error: 'Authorization code required' })
    return
  }

  const clientId = getEnvValue(env, 'VITE_WITHINGS_CLIENT_ID', 'WITHINGS_CLIENT_ID')
  const clientSecret = getEnvValue(env, 'WITHINGS_CLIENT_SECRET')
  const envRedirect = getEnvValue(env, 'VITE_WITHINGS_REDIRECT_URI', 'WITHINGS_REDIRECT_URI')
  const redirectUri = resolveWithingsRedirectUriForTokenExchange({
    bodyRedirectUri: redirect_uri,
    envRedirectUri: envRedirect || undefined,
    requestOrigin: (req.headers.origin as string | undefined) || 'http://localhost:5173',
  })
  if (!redirectUri) {
    json(res, 400, { error: 'redirect_uri could not be resolved' })
    return
  }
  if (!clientId || !clientSecret) {
    json(res, 500, {
      error: 'Withings not configured. Set VITE_WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET in .env.local',
    })
    return
  }

  try {
    const result = await withingsRequestToken(clientId, clientSecret, {
      action: 'requesttoken',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code',
    })
    json(res, 200, {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      userid: result.userid,
      expires_in: result.expires_in,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Withings OAuth failed'
    const isServiceUnavailable = message.includes('temporarily unavailable')
    if (isServiceUnavailable) {
      console.warn('[OAuth Local] Withings:', message)
    } else {
      console.error('[OAuth Local] Withings', message, e)
    }
    const status =
      message.includes('not configured') || message.includes('required')
        ? 500
        : isServiceUnavailable
          ? 503
          : 400
    json(res, status, { error: message })
  }
}

async function handleWithingsRefreshRequest(req: IncomingMessage, res: ServerResponse, env: EnvMap) {
  setCors(res, 'POST, OPTIONS', 'Content-Type')
  if (handlePreflightAndMethod(req, res)) return

  const payload = await readJsonBody<{ refresh_token?: string }>(req, res)
  if (!payload) return
  const { refresh_token } = payload
  if (!refresh_token) {
    json(res, 400, { error: 'refresh_token required' })
    return
  }

  const clientId = getEnvValue(env, 'VITE_WITHINGS_CLIENT_ID', 'WITHINGS_CLIENT_ID')
  const clientSecret = getEnvValue(env, 'WITHINGS_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    json(res, 500, { error: 'Withings not configured' })
    return
  }

  try {
    const result = await withingsRequestToken(clientId, clientSecret, {
      action: 'requesttoken',
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token,
    })
    json(res, 200, {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      userid: result.userid,
      expires_in: result.expires_in,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Withings refresh failed'
    const isServiceUnavailable = message.includes('temporarily unavailable')
    if (isServiceUnavailable) {
      console.warn('[OAuth Local] Withings refresh:', message)
    } else {
      console.error('[OAuth Local] Withings refresh', e)
    }
    json(res, isServiceUnavailable ? 503 : 500, { error: message })
  }
}

async function handleStravaOAuthRequest(req: IncomingMessage, res: ServerResponse, env: EnvMap) {
  setCors(res, 'POST, OPTIONS', 'Content-Type')
  if (handlePreflightAndMethod(req, res)) return

  const payload = await readJsonBody<{ code?: string; redirect_uri?: string }>(req, res)
  if (!payload) return
  const { code, redirect_uri } = payload
  if (!code) {
    console.error('[OAuth Local] Missing authorization code')
    json(res, 400, { error: 'Authorization code required' })
    return
  }

  const clientSecret = getEnvValue(env, 'STRAVA_CLIENT_SECRET')
  const clientId = getEnvValue(env, 'STRAVA_CLIENT_ID') || '157217'
  if (!clientSecret) {
    console.error('[OAuth Local] STRAVA_CLIENT_SECRET not configured')
    json(res, 500, {
      error: 'Server configuration error: STRAVA_CLIENT_SECRET not set. Please set it in your .env.local file.',
    })
    return
  }

  try {
    const data = await exchangeStravaCodeForToken({
      code,
      clientId,
      clientSecret,
      redirectUri: redirect_uri || `${req.headers.origin}/settings`,
    })

    json(res, 200, {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    })
  } catch (error) {
    if (error instanceof StravaAuthError) {
      console.error('[OAuth Local] Strava token exchange error:', error.details ?? error.message)
      json(res, error.status, { error: error.message, details: error.details })
      return
    }
    console.error('[OAuth Local] Token exchange error:', error)
    json(res, 500, {
      error: 'Failed to exchange authorization code',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

async function handleStravaRefreshRequest(req: IncomingMessage, res: ServerResponse, env: EnvMap) {
  setCors(res, 'POST, OPTIONS', 'Content-Type')
  if (handlePreflightAndMethod(req, res)) return

  const payload = await readJsonBody<{ refresh_token?: string }>(req, res)
  if (!payload) return
  const { refresh_token } = payload
  if (!refresh_token) {
    json(res, 400, { error: 'refresh_token required' })
    return
  }

  const clientSecret = getEnvValue(env, 'STRAVA_CLIENT_SECRET')
  const clientId = getEnvValue(env, 'STRAVA_CLIENT_ID') || '157217'
  if (!clientSecret) {
    json(res, 500, { error: 'Strava not configured. Set STRAVA_CLIENT_SECRET.' })
    return
  }

  try {
    const data = await refreshStravaAccessToken({
      refreshToken: refresh_token,
      clientId,
      clientSecret,
    })
    json(res, 200, {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    })
  } catch (e) {
    if (e instanceof StravaAuthError) {
      json(res, e.status, { error: e.message })
      return
    }
    console.error('[OAuth Local] Strava refresh', e)
    json(res, 500, { error: e instanceof Error ? e.message : 'Strava refresh failed' })
  }
}

function registerAiEndpoint(
  path: string,
  runHandler: (body: any, headers: HeaderMap) => Promise<{ text: string } | { error: string; status?: number }>
) {
  return (req: IncomingMessage, res: ServerResponse) => {
    setCors(res, 'POST, OPTIONS', 'Content-Type, Authorization, x-openai-key')
    if (handlePreflightAndMethod(req, res)) return

    readJsonBody<any>(req, res)
      .then((parsed) => {
        if (!parsed) return
        const headers = toHeaderMap(req)
        return runHandler(parsed, headers)
          .then((out) => {
            if ('error' in out) {
              json(res, out.status ?? 400, { error: out.error })
            } else {
              json(res, 200, out)
            }
          })
          .catch((err: Error & { status?: number }) => {
            console.error(`[vite api] ${path}`, err)
            const message = err?.message || 'Failed to complete AI request.'
            json(res, err?.status ?? 500, { error: message })
          })
      })
      .catch(() => {
        json(res, 500, { error: 'Failed to process request body' })
      })
  }
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
      
      server.middlewares.use(async (req, res, next) => {
        const pathOnly = req.url?.split('?')[0]
        if (pathOnly !== '/api/admlog') {
          next()
          return
        }
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        try {
          Object.assign(process.env, mergedEnv)
          const { default: admlogHandler } = await import('../../api/admlog/index.ts')
          const url = new URL(req.url || '/', 'http://127.0.0.1:5173')
          const mockReq = {
            method: req.method,
            headers: req.headers,
            query: Object.fromEntries(url.searchParams.entries()),
            url: req.url,
          }
          await admlogHandler(mockReq as never, adaptNodeResponseToVercel(res as ServerResponse))
        } catch (err) {
          next(err)
        }
      })

      server.middlewares.use('/api/strava-oauth', (req, res, next) => {
        handleStravaOAuthRequest(req, res, mergedEnv).catch(next)
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
        Object.assign(process.env, mergedEnv)
        registerAiEndpoint('ai-chat', handleAiChatRequest)(req, res)
      })
      server.middlewares.use('/api/ai-coach', (req, res) => {
        Object.assign(process.env, mergedEnv)
        registerAiEndpoint('ai-coach', handleAiCoachRequest)(req, res)
      })
    },
  }
}

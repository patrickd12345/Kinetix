import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors.js'
import { sendApiError } from '../_lib/apiError.js'
import { resolveKinetixRuntimeEnv } from '../_lib/env/runtime.js'
import {
  deleteProviderToken,
  listProviderConnections,
  requireSupabaseUser,
  type KinetixProvider,
} from '../_lib/providerTokenVault.js'

function readProvider(value: unknown): KinetixProvider | null {
  return value === 'strava' || value === 'withings' ? value : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['GET', 'DELETE', 'OPTIONS'],
    headers: ['Authorization', 'Content-Type'],
  })
  if (!cors.allowed) return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    return sendApiError(res, 405, 'Method not allowed', { source: req.headers })
  }

  const runtime = resolveKinetixRuntimeEnv()
  let user: { id: string }
  try {
    user = await requireSupabaseUser(req, runtime)
  } catch {
    return sendApiError(res, 401, 'Authentication required', { source: req.headers })
  }

  if (req.method === 'DELETE') {
    const provider = readProvider(req.query.provider)
    if (!provider) return sendApiError(res, 400, 'provider must be strava or withings', { source: req.headers })
    await deleteProviderToken(runtime, user.id, provider)
    return res.status(200).json({ provider, connected: false })
  }

  const connections = await listProviderConnections(runtime, user.id)
  return res.status(200).json({ connections })
}


import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors'
import { refreshStravaAccessToken, StravaAuthError } from '../_lib/stravaAuth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['POST', 'OPTIONS'],
    headers: ['Content-Type'],
  })

  if (!cors.allowed) {
    return res.status(403).json({ error: 'Origin not allowed' })
  }

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { refresh_token } = (req.body ?? {}) as { refresh_token?: string }
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' })

  const clientId = process.env.VITE_STRAVA_CLIENT_ID ?? process.env.STRAVA_CLIENT_ID ?? '157217'
  const clientSecret = process.env.STRAVA_CLIENT_SECRET

  if (!clientSecret) {
    return res.status(500).json({
      error: 'Strava not configured. Set STRAVA_CLIENT_SECRET.',
    })
  }

  try {
    const data = await refreshStravaAccessToken({
      refreshToken: refresh_token,
      clientId,
      clientSecret,
    })
    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    })
  } catch (err) {
    if (err instanceof StravaAuthError) {
      return res.status(err.status).json({
        error: err.message,
      })
    }
    console.error('[Strava Refresh]', err)
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to refresh Strava token',
    })
  }
}

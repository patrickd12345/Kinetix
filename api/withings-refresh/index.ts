import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors'
import { refreshWithingsToken } from '../_lib/withingsAuth'

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

  const { refresh_token } = req.body ?? {}
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' })

  const clientId = process.env.VITE_WITHINGS_CLIENT_ID ?? process.env.WITHINGS_CLIENT_ID
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: 'Withings not configured. Set WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET.',
    })
  }

  try {
    const result = await refreshWithingsToken({ clientId, clientSecret }, refresh_token)
    res.status(200).json({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      userid: result.userid,
      expires_in: result.expires_in,
    })
  } catch (err) {
    console.error('[Withings Refresh]', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to refresh Withings token',
    })
  }
}

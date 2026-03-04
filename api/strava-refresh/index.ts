import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

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
      return res.status(refreshRes.status).json({
        error: (errData as { message?: string }).message ?? 'Strava refresh failed',
      })
    }
    const data = (await refreshRes.json()) as {
      access_token: string
      refresh_token: string
      expires_at: number
    }
    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    })
  } catch (err) {
    console.error('[Strava Refresh]', err)
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to refresh Strava token',
    })
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { exchangeWithingsCode } from '../_lib/withingsAuth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { code, redirect_uri } = req.body ?? {}
  if (!code) return res.status(400).json({ error: 'Authorization code required' })

  const clientId = process.env.VITE_WITHINGS_CLIENT_ID ?? process.env.WITHINGS_CLIENT_ID
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET
  const redirectUri = redirect_uri ?? `${req.headers.origin ?? ''}/settings`

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: 'Withings OAuth not configured. Set WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET.',
    })
  }

  try {
    const result = await exchangeWithingsCode(
      { clientId, clientSecret, redirectUri },
      code
    )
    res.status(200).json({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      userid: result.userid,
      expires_in: result.expires_in,
    })
  } catch (err) {
    console.error('[Withings OAuth]', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to exchange Withings authorization code',
    })
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withSentryApiHandler, captureApiException } from '../_lib/sentry.js'

type HealthPayload = {
  status: 'ok'
  service: 'kinetix'
  timestamp: number
}

function getPayload(): HealthPayload {
  return {
    status: 'ok',
    service: 'kinetix',
    timestamp: Date.now(),
  }
}

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify(getPayload()), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

async function healthHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  try {
    res.status(200).json(getPayload())
  } catch (error) {
    captureApiException(error)
    res.status(500).json({ error: 'health_check_failed' })
  }
}

export default withSentryApiHandler(healthHandler)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from './_lib/cors.js'
import { sendApiError } from './_lib/apiError.js'
import { resolveKinetixRuntimeEnv } from './_lib/env/runtime.js'

type EscalationNotifyBody = {
  ticketId?: string
  title?: string
  escalationLevel?: number
  createdAt?: string
  assignee?: string
  labels?: string[]
}

const RESEND_WINDOW_MS = 24 * 60 * 60 * 1000
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const MAX_NOTIFICATIONS_PER_MINUTE = 50
const sentEscalations = new Map<string, number>()
const sentAttemptTimestamps: number[] = []

function currentBucket(now: number) {
  return Math.floor(now / RESEND_WINDOW_MS)
}

function cleanupSentEscalations(bucket: number) {
  for (const [key, keyBucket] of sentEscalations.entries()) {
    if (keyBucket < bucket) {
      sentEscalations.delete(key)
    }
  }
}

function cleanupRateLimitWindow(now: number) {
  while (sentAttemptTimestamps.length > 0 && now - sentAttemptTimestamps[0] >= RATE_LIMIT_WINDOW_MS) {
    sentAttemptTimestamps.shift()
  }
}

function resolveEnvironmentLabel() {
  const runtime = resolveKinetixRuntimeEnv()
  const raw = (process.env.VERCEL_ENV || runtime.nodeEnv || '').trim().toLowerCase()
  if (raw === 'production' || raw === 'prod') return 'PROD'
  if (raw === 'preview' || raw === 'staging' || raw === 'stage') return 'STAGING'
  if (raw === 'development' || raw === 'dev' || raw === 'test' || raw === 'local') return 'DEV'
  return 'UNKNOWN'
}

function buildQueueLink(ticketId: string) {
  const baseUrl = resolveKinetixRuntimeEnv().kinetixAppBaseUrl
  const path = `/support-queue?ticketId=${encodeURIComponent(ticketId)}`
  if (!baseUrl) return path
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

function normalizeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => String(entry).trim()).filter(Boolean)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['POST', 'OPTIONS'],
    headers: ['Content-Type'],
  })
  if (!cors.allowed) return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return sendApiError(res, 405, 'Method not allowed', { source: req.headers })

  if (process.env.VITE_ENABLE_ESCALATION?.trim().toLowerCase() === 'false') return res.status(204).end()

  const webhook = process.env.ESCALATION_SLACK_WEBHOOK_URL
  if (!webhook) return res.status(204).end()

  const body = (req.body ?? {}) as EscalationNotifyBody
  const ticketId = typeof body.ticketId === 'string' ? body.ticketId.trim() : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const assignee = typeof body.assignee === 'string' ? body.assignee.trim() : ''
  const labels = normalizeLabels(body.labels)
  const escalationLevel =
    typeof body.escalationLevel === 'number' && Number.isFinite(body.escalationLevel)
      ? body.escalationLevel
      : Number.NaN

  if (!ticketId) return sendApiError(res, 400, 'ticketId is required', { source: req.headers })
  if (!Number.isFinite(escalationLevel)) {
    return sendApiError(res, 400, 'escalationLevel is required', { source: req.headers })
  }

  const now = Date.now()
  const bucket = currentBucket(now)
  const dedupeKey = `${ticketId}:${escalationLevel}:${bucket}`
  cleanupSentEscalations(bucket)
  if (sentEscalations.has(dedupeKey)) return res.status(204).end()

  cleanupRateLimitWindow(now)
  if (sentAttemptTimestamps.length >= MAX_NOTIFICATIONS_PER_MINUTE) {
    console.warn('Escalation notification suppressed', { reason: 'rate_limited', ticketId, escalationLevel })
    return res.status(204).end()
  }

  try {
    const lines = [
      `🚨 [${resolveEnvironmentLabel()}] Kinetix Escalation`,
      `Ticket: ${ticketId}`,
      `Level: ${escalationLevel}`,
    ]
    if (title) lines.push(`Title: ${title}`)
    lines.push(`Link: ${buildQueueLink(ticketId)}`)
    if (typeof body.createdAt === 'string' && body.createdAt.trim()) {
      lines.push(`Time: ${body.createdAt.trim()}`)
    }
    if (assignee) lines.push(`Assignee: ${assignee}`)
    if (labels.length > 0) lines.push(`Labels: ${labels.join(', ')}`)

    sentAttemptTimestamps.push(now)
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n') }),
    })

    if (!response.ok) {
      console.warn('Escalation notification failed', { ticketId, escalationLevel, status: response.status })
      return res.status(204).end()
    }

    sentEscalations.set(dedupeKey, bucket)
    return res.status(204).end()
  } catch (error) {
    console.warn('Escalation notification failed', {
      ticketId,
      escalationLevel,
      error: error instanceof Error ? error.message : String(error),
    })
    return res.status(204).end()
  }
}

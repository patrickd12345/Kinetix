/**
 * Curated support artifact validation for ingest (no raw tickets).
 * Shape aligns with apps/web/HELP_CENTER_ARCHITECTURE.md — minimal required fields for v1.
 */

export const SUPPORT_KB_TOPICS = Object.freeze([
  'account',
  'billing',
  'sync',
  'import',
  'kps',
  'charts',
  'privacy',
  'general',
])

export const SUPPORT_KB_INTENTS = Object.freeze(['howto', 'troubleshoot', 'policy', 'limitation'])

export const SUPPORT_KB_SOURCE_TYPES = Object.freeze(['editorial', 'ticket_resolution', 'faq'])

const TOPIC_SET = new Set(SUPPORT_KB_TOPICS)
const INTENT_SET = new Set(SUPPORT_KB_INTENTS)
const SOURCE_SET = new Set(SUPPORT_KB_SOURCE_TYPES)

const MAX_BODY_LEN = 50_000
const MAX_EXCERPT_LEN = 2000

/**
 * @param {Record<string, unknown>} a
 * @returns {{ ok: true, artifact: Record<string, unknown> } | { ok: false, errors: string[] }}
 */
export function validateSupportArtifactForIngest(a) {
  const errors = []

  if (!a || typeof a !== 'object') {
    return { ok: false, errors: ['artifact must be an object'] }
  }

  const artifact_id = a.artifact_id
  if (typeof artifact_id !== 'string' || !artifact_id.trim()) {
    errors.push('artifact_id is required (non-empty string)')
  } else if (!/^[\w.-]+$/.test(artifact_id.trim())) {
    errors.push('artifact_id must be slug-safe (letters, numbers, dots, hyphens, underscores)')
  }

  const title = a.title
  if (typeof title !== 'string' || !title.trim()) {
    errors.push('title is required')
  }

  const body = a.body_markdown
  if (typeof body !== 'string' || !body.trim()) {
    errors.push('body_markdown is required')
  } else if (body.length > MAX_BODY_LEN) {
    errors.push(`body_markdown exceeds ${MAX_BODY_LEN} characters`)
  }

  if (a.excerpt !== undefined && a.excerpt !== null) {
    if (typeof a.excerpt !== 'string') {
      errors.push('excerpt must be a string when provided')
    } else if (a.excerpt.length > MAX_EXCERPT_LEN) {
      errors.push(`excerpt exceeds ${MAX_EXCERPT_LEN} characters`)
    }
  }

  const version = a.version
  if (version === undefined || version === null || version === '') {
    errors.push('version is required')
  } else {
    const n = typeof version === 'number' ? version : Number.parseFloat(String(version).trim())
    if (Number.isNaN(n) || n < 1) {
      errors.push('version must be a number >= 1')
    }
  }

  const review_status = a.review_status
  if (review_status !== 'approved') {
    errors.push('review_status must be "approved" for KB ingest (draft/deprecated rejected)')
  }

  const product = a.product ?? 'kinetix'
  if (product !== 'kinetix') {
    errors.push('product must be "kinetix" for this service')
  }

  const topic = a.topic
  if (typeof topic !== 'string' || !TOPIC_SET.has(topic)) {
    errors.push(`topic must be one of: ${SUPPORT_KB_TOPICS.join(', ')}`)
  }

  const intent = a.intent
  if (typeof intent !== 'string' || !INTENT_SET.has(intent)) {
    errors.push(`intent must be one of: ${SUPPORT_KB_INTENTS.join(', ')}`)
  }

  const source_type = a.source_type
  if (typeof source_type !== 'string' || !SOURCE_SET.has(source_type)) {
    errors.push(`source_type must be one of: ${SUPPORT_KB_SOURCE_TYPES.join(', ')}`)
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const versionNum =
    typeof version === 'number' ? version : Number.parseFloat(String(version).trim())

  const excerpt =
    typeof a.excerpt === 'string' && a.excerpt.trim()
      ? String(a.excerpt).trim()
      : undefined

  const normalized = {
    artifact_id: String(artifact_id).trim(),
    title: String(title).trim(),
    excerpt,
    body_markdown: String(body),
    version: versionNum,
    locale: typeof a.locale === 'string' && a.locale.trim() ? a.locale.trim() : 'en',
    product: 'kinetix',
    surface: typeof a.surface === 'string' && a.surface.trim() ? a.surface.trim() : 'web',
    topic,
    intent,
    review_status: 'approved',
    source_type,
  }

  return { ok: true, artifact: normalized }
}

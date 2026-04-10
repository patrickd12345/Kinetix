export type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error'
export type RequestIdSource = unknown
export type AiLogMetadata = Record<string, unknown>

export function emitStructuredLog(_level: StructuredLogLevel, _event: string, _fields: Record<string, unknown> = {}) {}
export function emitAiLog(_level: StructuredLogLevel, _event: string, _metadata: AiLogMetadata, _fields: Record<string, unknown> = {}) {}
export function getRequestId(source?: RequestIdSource): string {
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const headers = source as Record<string, unknown>
    const direct =
      headers['x-request-id'] ?? headers['X-Request-Id'] ?? headers['X-Request-ID']
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim()
    }
  }
  return crypto.randomUUID()
}

export type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error'
export type RequestIdSource = unknown
export type AiLogMetadata = Record<string, unknown>

export function emitStructuredLog(_level: StructuredLogLevel, _event: string, _fields: Record<string, unknown> = {}) {}
export function emitAiLog(_level: StructuredLogLevel, _event: string, _metadata: AiLogMetadata, _fields: Record<string, unknown> = {}) {}
export function getRequestId(_source?: RequestIdSource): string {
  return crypto.randomUUID()
}

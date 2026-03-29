import {
  emitAiLog,
  emitStructuredLog,
  getRequestId,
  type AiLogMetadata,
  type RequestIdSource,
  type StructuredLogLevel,
} from '@bookiji-inc/observability'

export function logApiEvent(
  level: StructuredLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
) {
  emitStructuredLog(level, event, fields)
}

export function logAiEvent(
  event: string,
  metadata: AiLogMetadata,
  fields: Record<string, unknown> = {},
) {
  emitAiLog('info', event, metadata, fields)
}

export function getObservedRequestId(source?: RequestIdSource) {
  return getRequestId(source)
}

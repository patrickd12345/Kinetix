import type { StructuredLogLevel, StructuredLogSink } from './log'
import { emitStructuredLog } from './log'

export type StripeLogFields = {
  eventId?: string
  eventType?: string
  signatureResult?: string
  idempotencyResult?: string
  requestId?: string
} & Record<string, unknown>

type EmitStripeLogOptions = {
  sink?: StructuredLogSink
  timestamp?: string
}

export function buildStripeLogFields(fields: StripeLogFields = {}): Record<string, unknown> {
  const { eventId, eventType, signatureResult, idempotencyResult, requestId, ...rest } = fields
  return {
    event_id: eventId,
    event_type: eventType,
    signature_result: signatureResult,
    idempotency_result: idempotencyResult,
    request_id: requestId,
    ...rest,
  }
}

export function emitStripeLog(
  level: StructuredLogLevel,
  event: string,
  fields: StripeLogFields = {},
  options: EmitStripeLogOptions = {},
) {
  return emitStructuredLog(level, event, buildStripeLogFields(fields), options)
}

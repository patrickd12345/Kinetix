import { emitStructuredLog } from '@bookiji-inc/observability'

export type AiCoreTelemetryPayload = {
  keySource: 'user' | 'platform'
  provider: string
  model: string
  fallbackUsed: boolean
  outcome: 'success' | 'failure'
  errorMessage?: string
}

export function recordAiCoreTelemetry(payload: AiCoreTelemetryPayload): void {
  emitStructuredLog('info', 'ai_core_request', {
    keySource: payload.keySource,
    provider: payload.provider,
    model: payload.model,
    fallbackUsed: payload.fallbackUsed,
    outcome: payload.outcome,
    ...(payload.errorMessage ? { errorMessage: payload.errorMessage } : {}),
  })
}

import type { StructuredLogLevel, StructuredLogSink } from './log'
import { emitStructuredLog } from './log'

export type AiLogMetadata = {
  provider: string
  model: string
  mode: string
  latencyMs: number
  fallbackReason: string | null
}

type EmitAiLogOptions = {
  sink?: StructuredLogSink
  timestamp?: string
}

export function buildAiLogFields(
  metadata: AiLogMetadata,
  fields: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    provider: metadata.provider,
    model: metadata.model,
    mode: metadata.mode,
    latencyMs: metadata.latencyMs,
    fallback: metadata.fallbackReason !== null,
    fallbackReason: metadata.fallbackReason,
    ...fields,
  }
}

export function emitAiLog(
  level: StructuredLogLevel,
  event: string,
  metadata: AiLogMetadata,
  fields: Record<string, unknown> = {},
  options: EmitAiLogOptions = {},
) {
  return emitStructuredLog(level, event, buildAiLogFields(metadata, fields), options)
}

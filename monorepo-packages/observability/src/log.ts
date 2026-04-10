export type StructuredLogLevel = 'info' | 'warn' | 'error'

export type StructuredLogEntry = {
  ts: string
  level: StructuredLogLevel
  event: string
} & Record<string, unknown>

export type StructuredLogSink = (
  level: StructuredLogLevel,
  line: string,
  entry: StructuredLogEntry,
) => void

type EmitStructuredLogOptions = {
  timestamp?: string
  sink?: StructuredLogSink
}

function defaultSink(level: StructuredLogLevel, line: string): void {
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.info(line)
}

export function buildStructuredLogEntry(
  level: StructuredLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
  timestamp = new Date().toISOString(),
): StructuredLogEntry {
  return {
    ts: timestamp,
    level,
    event,
    ...fields,
  }
}

export function emitStructuredLog(
  level: StructuredLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
  options: EmitStructuredLogOptions = {},
): StructuredLogEntry {
  const entry = buildStructuredLogEntry(level, event, fields, options.timestamp)
  const line = JSON.stringify(entry)
  const sink = options.sink ?? defaultSink
  sink(level, line, entry)
  return entry
}

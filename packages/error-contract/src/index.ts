export type CanonicalError = {
  code: string
  message: string
  details?: string
  requestId?: string
}

export type RequestIdSource = unknown
export type ToHttpErrorOptions = {
  defaultCode?: string
  defaultStatus?: number
  fallbackCode?: string
  fallbackMessage?: string
  fallbackStatus?: number
  requestId?: string
}

export function getOrCreateRequestId(source?: RequestIdSource): string {
  if (typeof source === 'string' && source.trim()) return source
  return crypto.randomUUID()
}

export function buildError(code: string, message: string, details?: string, requestId?: string): CanonicalError {
  const err: CanonicalError = { code, message }
  if (details !== undefined) err.details = details
  if (requestId !== undefined) err.requestId = requestId
  return err
}

export function toHttpError(error: unknown, options: ToHttpErrorOptions = {}) {
  const status = options.fallbackStatus ?? options.defaultStatus ?? 500
  const code = options.fallbackCode ?? options.defaultCode ?? 'internal_error'
  const message = error instanceof Error
    ? error.message
    : (options.fallbackMessage ?? String(error ?? 'Unknown error'))
  return {
    status,
    error: buildError(code, message, undefined, options.requestId),
  }
}

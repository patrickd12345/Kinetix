export type CanonicalError = {
  code: string
  message: string
  details?: string
  requestId?: string
}

export type RequestIdSource = unknown
export type ToHttpErrorOptions = { defaultCode?: string; defaultStatus?: number }

export function getOrCreateRequestId(source?: RequestIdSource): string {
  if (typeof source === 'string' && source.trim()) return source
  return crypto.randomUUID()
}

export function buildError(code: string, message: string, details?: string, requestId?: string): CanonicalError {
  return { code, message, details, requestId }
}

export function toHttpError(error: unknown, options: ToHttpErrorOptions = {}) {
  const status = options.defaultStatus ?? 500
  const code = options.defaultCode ?? 'internal_error'
  if (error instanceof Error) {
    return { status, error: buildError(code, error.message) }
  }
  return { status, error: buildError(code, String(error ?? 'Unknown error')) }
}

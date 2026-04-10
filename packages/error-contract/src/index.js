export function getOrCreateRequestId(source) {
  if (typeof source === 'string' && source.trim()) return source
  return crypto.randomUUID()
}

export function buildError(code, message, details, requestId) {
  const err = { code, message }
  if (details !== undefined) err.details = details
  if (requestId !== undefined) err.requestId = requestId
  return err
}

export function toHttpError(error, options = {}) {
  const status = options.fallbackStatus ?? options.defaultStatus ?? 500
  const code = options.fallbackCode ?? options.defaultCode ?? 'internal_error'
  const message =
    error instanceof Error ? error.message : options.fallbackMessage ?? String(error ?? 'Unknown error')
  return {
    status,
    error: buildError(code, message, undefined, options.requestId),
  }
}

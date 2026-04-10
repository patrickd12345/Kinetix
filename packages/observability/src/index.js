export function emitStructuredLog(_level, _event, _fields = {}) {}

export function emitAiLog(_level, _event, _metadata, _fields = {}) {}

export function getRequestId(source) {
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const headers = source
    const direct = headers['x-request-id'] ?? headers['X-Request-Id'] ?? headers['X-Request-ID']
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim()
    }
  }
  return crypto.randomUUID()
}

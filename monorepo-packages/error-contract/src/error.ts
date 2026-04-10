const KEY_PATTERN = /(sk-[A-Za-z0-9_-]{10,})/g

export type CanonicalError = {
  code: string
  message: string
  details?: string
  requestId?: string
}

export function sanitizeErrorMessage(message: string, fallbackMessage = 'Internal Server Error'): string {
  const normalized = message.trim()
  if (!normalized) {
    return fallbackMessage
  }
  return normalized.replace(KEY_PATTERN, '[redacted]')
}

export function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim()
  return normalized ? sanitizeErrorMessage(normalized, normalized) : undefined
}

export function buildError(
  code: string,
  message: string,
  details?: string,
  requestId?: string,
): CanonicalError {
  return {
    code,
    message,
    ...(details ? { details } : {}),
    ...(requestId ? { requestId } : {}),
  }
}

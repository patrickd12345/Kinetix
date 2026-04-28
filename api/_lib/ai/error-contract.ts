import {
  buildError,
  getOrCreateRequestId,
  toHttpError,
  type CanonicalError,
  type RequestIdSource,
  type ToHttpErrorOptions,
} from '@bookiji-inc/error-contract'

export type KinetixApiError = CanonicalError & {
  status?: number
}

type HeaderMap = Record<string, string | string[] | undefined>

function readRequestIdFromHeaders(headers: HeaderMap): string | undefined {
  const candidates = [
    headers['x-request-id'],
    headers['X-Request-Id'],
    headers['X-Request-ID'],
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i]
        if (typeof item === 'string' && item.trim()) {
          return item.trim()
        }
      }
    }
  }

  return undefined
}

export function getApiRequestId(source?: RequestIdSource | HeaderMap): string {
  if (source && typeof source === 'object' && !('get' in source) && !(source instanceof Request)) {
    return getOrCreateRequestId(readRequestIdFromHeaders(source as HeaderMap))
  }

  return getOrCreateRequestId(source as RequestIdSource | undefined)
}

export function buildKinetixApiError(
  code: string,
  message: string,
  status: number,
  requestId?: string,
  details?: string,
): KinetixApiError {
  return {
    ...buildError(code, message, details, requestId),
    status,
  }
}

export function serializeApiError(error: KinetixApiError): CanonicalError {
  return buildError(error.code, error.message, error.details, error.requestId)
}

export function toApiHttpError(error: unknown, options?: ToHttpErrorOptions) {
  return toHttpError(error, options)
}
